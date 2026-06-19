/**
 * Web-side capture publish (whiteboard recordings). Mirrors the extension's
 * instant-link pipeline without the chrome plumbing:
 *
 *   fix webm duration → create the metadata row + share link IMMEDIATELY
 *   (uploadStatus: UPLOADING) → capture a poster thumbnail → upload the bytes
 *   straight to the user's default destination (Drive / Dropbox / Vyooom Cloud)
 *   → finalize (attach file id + thumbnail, apply the storage ACL).
 *
 * The caller gets the share URL via `onLinkReady` seconds after save is pressed,
 * while the bytes are still in flight; the share page shows "processing" until
 * the upload lands. Uses XHR (not fetch) for upload progress events.
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
import { api } from "./api.js";

export interface WebPublishParams {
  blob: Blob;
  title: string;
  durationMs: number;
  destination: StorageProvider;
  onLinkReady?: (shareUrl: string, mediaId: string) => void;
  onProgress?: (fraction: number) => void;
}

export interface WebPublishResult {
  mediaId: string;
  shareUrl: string;
}

function xhrUpload(opts: {
  url: string;
  method: "PUT" | "POST";
  body: Blob;
  headers: Record<string, string>;
  onProgress?: (fraction: number) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url, true);
    for (const [k, v] of Object.entries(opts.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? (opts.onProgress?.(1), resolve(xhr.responseText))
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("The connection dropped during the upload."));
    xhr.send(opts.body);
  });
}

/** Upload the raw bytes to the chosen destination; returns the storage file id. */
async function uploadBytes(
  destination: StorageProvider,
  blob: Blob,
  fileName: string,
  mimeType: VideoMimeType | ImageMimeType,
  resourceType: ResourceType,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const initiate = { fileName, mimeType, sizeBytes: blob.size, resourceType };
  if (destination === StorageProvider.DRIVE) {
    const { sessionUri } = await api.initiateDriveUpload(initiate);
    const text = await xhrUpload({
      url: sessionUri,
      method: "PUT",
      body: blob,
      headers: { "Content-Type": mimeType },
      onProgress,
    });
    const fileId = (JSON.parse(text) as { id?: string }).id;
    if (!fileId) throw new Error("Drive did not return a file id.");
    return fileId;
  }
  if (destination === StorageProvider.DROPBOX) {
    const { accessToken, path } = await api.initiateDropboxUpload(initiate);
    const text = await xhrUpload({
      url: "https://content.dropboxapi.com/2/files/upload",
      method: "POST",
      body: blob,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({ path, mode: "add", autorename: true, mute: true }),
        "Content-Type": "application/octet-stream",
      },
      onProgress,
    });
    try {
      return (JSON.parse(text) as { path_lower?: string }).path_lower ?? path;
    } catch {
      return path;
    }
  }
  const { signedUrl, path } = await api.initiateServerUpload(initiate);
  await xhrUpload({
    url: signedUrl,
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType, "x-upsert": "true" },
    onProgress,
  });
  return path;
}

/** Capture a poster frame (JPEG ≤640px) — best-effort, null on any failure. */
async function captureThumbnail(blob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  const step = (ev: string) =>
    new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), 5000);
      video.addEventListener(ev, () => (clearTimeout(t), res()), { once: true });
      video.addEventListener("error", () => (clearTimeout(t), rej(new Error("decode"))), { once: true });
    });
  try {
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    await step("loadeddata");
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = dur > 2 ? Math.min(1.5, dur * 0.1) : 0.1;
    await step("seeked").catch(() => {});
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 640 / w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

export async function publishWebRecording(params: WebPublishParams): Promise<WebPublishResult> {
  const { title, durationMs, destination, onLinkReady, onProgress } = params;
  let { blob } = params;
  if (blob.size === 0) throw new Error("The recording is empty (0 bytes) — nothing to save.");

  const mimeType = blob.type.includes("mp4") ? VideoMimeType.MP4 : VideoMimeType.WEBM;
  const baseName = sanitizeFileName(title) || "whiteboard";

  // MediaRecorder webm has no duration header → broken seek bars. Patch first.
  if (mimeType === VideoMimeType.WEBM && durationMs > 0) {
    try {
      blob = await fixWebmDuration(blob, durationMs, { logger: false });
    } catch {
      /* unpatched original still plays */
    }
  }

  // Instant link: metadata row + share URL before the bytes move.
  const { recording } = await api.createRecording({
    title,
    duration: Math.round(durationMs / 1000),
    size: blob.size,
    mimeType,
    storageProvider: destination,
  });
  const { shareUrl } = await api.createShare({
    resourceType: ResourceType.RECORDING,
    resourceId: recording.id,
    permission: SharePermission.VIEW,
  });
  onLinkReady?.(shareUrl, recording.id);

  // Poster for link previews + dashboard cards (best-effort).
  let thumbnailKey: string | undefined;
  const thumb = await captureThumbnail(blob);
  if (thumb) {
    try {
      const t = await api.initiateServerUpload({
        fileName: `${baseName}-thumb.jpg`,
        mimeType: ImageMimeType.JPEG,
        sizeBytes: thumb.size,
        resourceType: ResourceType.SCREENSHOT,
        purpose: "thumbnail", // system poster — allowed regardless of plan
      });
      await xhrUpload({
        url: t.signedUrl,
        method: "PUT",
        body: thumb,
        headers: { "Content-Type": ImageMimeType.JPEG, "x-upsert": "true" },
      });
      thumbnailKey = t.path;
    } catch {
      /* no poster is fine */
    }
  }

  const storageFileId = await uploadBytes(
    destination,
    blob,
    `${baseName}.webm`,
    mimeType,
    ResourceType.RECORDING,
    onProgress,
  );
  await api.finalizeRecording(recording.id, { storageFileId, size: blob.size, thumbnailKey });

  return { mediaId: recording.id, shareUrl };
}
