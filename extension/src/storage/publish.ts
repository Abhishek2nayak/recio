/**
 * The post-capture pipeline shared by the studio (video) and editor (screenshot).
 *
 * Recordings use the INSTANT-LINK flow (the Loom magic moment):
 *   fix webm duration → persist bytes locally → create the metadata row + share
 *   link IMMEDIATELY (uploadStatus: UPLOADING) → hand the link to the caller →
 *   capture a poster thumbnail → upload the bytes → finalize (attach file id,
 *   apply the storage ACL) → drop the local copy.
 * The user gets a working share URL seconds after hitting stop; the share page
 * shows "processing" until the bytes land. Screenshots keep the classic
 * upload-then-create flow (they're small and instant anyway).
 *
 * The capture is written to the pending-uploads store BEFORE the upload starts and
 * deleted only after everything succeeded, so a failed upload is never a lost
 * recording — it stays retryable/downloadable from the popup and studio, and a
 * retry reuses the same metadata row so the already-shared link stays valid.
 *
 * Progress is reported to the caller (for the modal's bar) AND mirrored to the
 * service worker, so the popup can reflect an in-flight upload after it reopens.
 */
import fixWebmDuration from "fix-webm-duration";
import {
  ImageMimeType,
  ResourceType,
  SharePermission,
  StorageProvider,
  VideoMimeType,
  sanitizeFileName,
} from "@flowcap/shared";
import { api } from "../lib/api.js";
import { addRecent, getSettings } from "../lib/storage.js";
import { sendMessage, type UploadState } from "../lib/messages.js";
import { deletePending, getPending, savePending, setPendingError } from "../lib/pendingUploads.js";
import { friendlyUploadError } from "../lib/uploadErrors.js";
import { captureVideoThumbnail } from "../lib/thumbnail.js";
import { uploadToDrive } from "./driveUploader.js";
import { uploadToDropbox } from "./dropboxUploader.js";
import { uploadToServer } from "./serverUploader.js";

export interface PublishParams {
  blob: Blob;
  title: string;
  type: "recording" | "screenshot";
  destination: StorageProvider;
  /** Active recording duration in ms (videos only). */
  durationMs?: number;
  /** The recorder's mime (may include codecs); only used to pick webm vs mp4. */
  recorderMime?: string;
  /** Reuse an existing pending-upload id (retry/recovery); a new one is made otherwise. */
  pendingId?: string;
  /** Metadata row from a previous attempt (retry) — keeps the share link stable. */
  mediaId?: string;
  /** Instant link: fires as soon as the share URL exists (upload still running). */
  onLinkReady?: (shareUrl: string, mediaId: string) => void;
  onProgress?: (fraction: number) => void;
}

export interface PublishResult {
  mediaId: string;
  shareUrl: string;
  provider: StorageProvider;
}

function videoMime(recorderMime?: string): VideoMimeType {
  return recorderMime?.includes("mp4") ? VideoMimeType.MP4 : VideoMimeType.WEBM;
}

/** Publish to the user's saved default destination (no destination prompt). */
export async function publishToDefault(
  params: Omit<PublishParams, "destination">,
): Promise<PublishResult> {
  const { destination } = await getSettings();
  return publishCapture({ ...params, destination });
}

/** Upload the raw bytes to the chosen destination; returns the storage file id. */
async function uploadBytes(
  destination: StorageProvider,
  blob: Blob,
  fileName: string,
  mimeType: VideoMimeType | ImageMimeType,
  resourceType: ResourceType,
  report: (fraction: number) => void,
): Promise<string> {
  const initiateInput = { fileName, mimeType, sizeBytes: blob.size, resourceType };
  if (destination === StorageProvider.DRIVE) {
    const { sessionUri } = await api.initiateDriveUpload(initiateInput);
    return (await uploadToDrive({ sessionUri, blob, mimeType, onProgress: report })).fileId;
  }
  if (destination === StorageProvider.DROPBOX) {
    const { accessToken, path } = await api.initiateDropboxUpload(initiateInput);
    return (
      await uploadToDropbox({
        accessToken,
        path,
        blob,
        onProgress: report,
        // A slow upload can outlive the relayed short-lived token; mint a fresh one.
        refreshAccessToken: async () => (await api.initiateDropboxUpload(initiateInput)).accessToken,
      })
    ).path;
  }
  const { signedUrl, path } = await api.initiateServerUpload(initiateInput);
  await uploadToServer({ signedUrl, blob, mimeType, onProgress: report });
  return path;
}

/** Best-effort poster upload (to Vyooom storage — tiny, powers link previews). */
async function uploadThumbnail(blob: Blob, baseName: string): Promise<string | undefined> {
  try {
    const thumb = await captureVideoThumbnail(blob);
    if (!thumb) return undefined;
    const { signedUrl, path } = await api.initiateServerUpload({
      fileName: `${baseName}-thumb.jpg`,
      mimeType: ImageMimeType.JPEG,
      sizeBytes: thumb.size,
      resourceType: ResourceType.SCREENSHOT,
      purpose: "thumbnail", // system poster — allowed regardless of plan
    });
    await uploadToServer({ signedUrl, blob: thumb, mimeType: ImageMimeType.JPEG });
    return path;
  } catch {
    return undefined; // a missing poster never blocks the recording
  }
}

export async function publishCapture(params: PublishParams): Promise<PublishResult> {
  const { title, type, destination, durationMs = 0, recorderMime, onProgress } = params;
  let { blob } = params;
  const id = params.pendingId ?? crypto.randomUUID();
  const isRecording = type === "recording";
  const resourceType = isRecording ? ResourceType.RECORDING : ResourceType.SCREENSHOT;
  const mimeType = isRecording ? videoMime(recorderMime) : ImageMimeType.PNG;
  const ext = isRecording ? "webm" : "png";
  const baseName = sanitizeFileName(title) || "capture";
  const fileName = `${baseName}.${ext}`;

  if (blob.size === 0) {
    // Don't upload (or keep) an empty capture — the recorder produced no data.
    throw new Error("The recording is empty (0 bytes) — nothing was uploaded. Try recording again.");
  }

  // MediaRecorder webm has no duration header → broken seek bars everywhere.
  // Patch it in-place before the bytes go anywhere (including the safety copy).
  if (isRecording && mimeType === VideoMimeType.WEBM && durationMs > 0) {
    try {
      blob = await fixWebmDuration(blob, durationMs, { logger: false });
    } catch {
      /* unpatched original still plays — keep going */
    }
  }

  // Safety net first: once the capture exists, it must survive any upload failure.
  let mediaId = params.mediaId ?? (await getPending(id).catch(() => null))?.mediaId;
  await savePending({
    id,
    title,
    type,
    mimeType,
    durationMs,
    sizeBytes: blob.size,
    createdAt: Date.now(),
    mediaId,
    blob,
  });

  const base: UploadState = { id, title, type, provider: destination, progress: 0, status: "uploading" };
  await sendMessage({ type: "UPLOAD_STARTED", upload: base });

  const report = (fraction: number) => {
    onProgress?.(fraction);
    void sendMessage({ type: "UPLOAD_PROGRESS", id, progress: fraction });
  };

  try {
    let shareUrl: string;

    if (isRecording) {
      // ── Instant link: metadata row + share URL BEFORE the bytes move. ──
      if (!mediaId) {
        const { recording } = await api.createRecording({
          title,
          duration: Math.round(durationMs / 1000),
          size: blob.size,
          mimeType: mimeType as VideoMimeType,
          storageProvider: destination,
          // no storageFileId yet → uploadStatus: UPLOADING
        });
        mediaId = recording.id;
        await savePending({
          id, title, type, mimeType, durationMs, sizeBytes: blob.size, createdAt: Date.now(), mediaId, blob,
        });
      }
      ({ shareUrl } = await api.createShare({
        resourceType,
        resourceId: mediaId,
        permission: SharePermission.VIEW,
      }));
      params.onLinkReady?.(shareUrl, mediaId);
      void sendMessage({ type: "UPLOAD_LINK_READY", id, mediaId, shareUrl });

      const thumbnailKey = await uploadThumbnail(blob, baseName);
      const storageFileId = await uploadBytes(destination, blob, fileName, mimeType, resourceType, report);
      await api.finalizeRecording(mediaId, { storageFileId, size: blob.size, thumbnailKey });
    } else {
      // ── Screenshots: small + instant — classic upload-then-create. ──
      const storageFileId = await uploadBytes(destination, blob, fileName, mimeType, resourceType, report);
      const { screenshot } = await api.createScreenshot({
        title,
        size: blob.size,
        mimeType: ImageMimeType.PNG,
        storageProvider: destination,
        storageFileId,
      });
      mediaId = screenshot.id;
      ({ shareUrl } = await api.createShare({
        resourceType,
        resourceId: mediaId,
        permission: SharePermission.VIEW,
      }));
    }

    await addRecent({ id: mediaId, title, type, provider: destination, shareUrl, createdAt: Date.now() });
    await deletePending(id); // fully landed — the local safety copy can go
    await sendMessage({ type: "UPLOAD_DONE", id, shareUrl });
    return { mediaId, shareUrl, provider: destination };
  } catch (err) {
    console.error("[Vyooom] publish failed:", err);
    const message = `${friendlyUploadError(err, destination)} Your ${type} is saved on this device — retry or download it from the Vyooom popup.`;
    await setPendingError(id, message).catch(() => {});
    await sendMessage({ type: "UPLOAD_FAILED", id, error: message });
    throw new Error(message);
  }
}
