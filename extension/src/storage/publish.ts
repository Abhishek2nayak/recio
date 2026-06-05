/**
 * The post-capture pipeline shared by the studio (video) and editor (screenshot):
 *   initiate upload → PUT bytes (Drive or Supabase) → save metadata → create share.
 *
 * Progress is reported to the caller (for the modal's bar) AND mirrored to the
 * service worker, so the popup can reflect an in-flight upload after it reopens.
 */
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

export async function publishCapture(params: PublishParams): Promise<PublishResult> {
  const { blob, title, type, destination, durationMs = 0, recorderMime, onProgress } = params;
  const id = crypto.randomUUID();
  const isRecording = type === "recording";
  const resourceType = isRecording ? ResourceType.RECORDING : ResourceType.SCREENSHOT;
  const mimeType = isRecording ? videoMime(recorderMime) : ImageMimeType.PNG;
  const ext = isRecording ? "webm" : "png";
  const fileName = `${sanitizeFileName(title) || "capture"}.${ext}`;

  const base: UploadState = { id, title, type, provider: destination, progress: 0, status: "uploading" };
  await sendMessage({ type: "UPLOAD_STARTED", upload: base });

  const report = (fraction: number) => {
    onProgress?.(fraction);
    void sendMessage({ type: "UPLOAD_PROGRESS", id, progress: fraction });
  };

  try {
    // 1. Upload the bytes straight to the destination.
    let storageFileId: string;
    if (destination === StorageProvider.DRIVE) {
      const { sessionUri } = await api.initiateDriveUpload({ fileName, mimeType, sizeBytes: blob.size, resourceType });
      ({ fileId: storageFileId } = await uploadToDrive({ sessionUri, blob, mimeType, onProgress: report }));
    } else if (destination === StorageProvider.DROPBOX) {
      const { accessToken, path } = await api.initiateDropboxUpload({ fileName, mimeType, sizeBytes: blob.size, resourceType });
      ({ path: storageFileId } = await uploadToDropbox({ accessToken, path, blob, onProgress: report }));
    } else {
      const { signedUrl, path } = await api.initiateServerUpload({ fileName, mimeType, sizeBytes: blob.size, resourceType });
      await uploadToServer({ signedUrl, blob, mimeType, onProgress: report });
      storageFileId = path;
    }

    // 2. Persist metadata.
    const mediaId = isRecording
      ? (
          await api.createRecording({
            title,
            duration: Math.round(durationMs / 1000),
            size: blob.size,
            mimeType: mimeType as VideoMimeType,
            storageProvider: destination,
            storageFileId,
          })
        ).recording.id
      : (
          await api.createScreenshot({
            title,
            size: blob.size,
            mimeType: ImageMimeType.PNG,
            storageProvider: destination,
            storageFileId,
          })
        ).screenshot.id;

    // 3. Create the shareable link (marks public; sets Drive "anyone with link").
    const { shareUrl } = await api.createShare({
      resourceType,
      resourceId: mediaId,
      permission: SharePermission.VIEW,
    });

    await addRecent({ id: mediaId, title, type, provider: destination, shareUrl, createdAt: Date.now() });
    await sendMessage({ type: "UPLOAD_DONE", id, shareUrl });
    return { mediaId, shareUrl, provider: destination };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    await sendMessage({ type: "UPLOAD_FAILED", id, error: message });
    throw err;
  }
}
