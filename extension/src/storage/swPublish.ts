/**
 * Service-worker-side publish for screenshots. SWs have `fetch` but not `XHR`, so
 * this mirrors `publish.ts` using fetch PUTs (no progress events — fine for small
 * images). Lets a screenshot upload straight from the background, with no extra tab.
 */
import {
  ImageMimeType,
  ResourceType,
  SharePermission,
  StorageProvider,
  sanitizeFileName,
} from "@flowcap/shared";
import { api } from "../lib/api.js";
import { addRecent, getSettings } from "../lib/storage.js";

async function fetchPut(url: string, blob: Blob, headers: Record<string, string>): Promise<Response> {
  const res = await fetch(url, { method: "PUT", body: blob, headers });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res;
}

export interface PublishResult {
  mediaId: string;
  shareUrl: string;
  provider: StorageProvider;
}

/** Upload a screenshot blob to the user's default destination + return a share link. */
export async function publishScreenshot(blob: Blob, title: string): Promise<PublishResult> {
  const { destination } = await getSettings();
  const fileName = `${sanitizeFileName(title) || "screenshot"}.png`;

  let storageFileId: string;
  if (destination === StorageProvider.DRIVE) {
    const { sessionUri } = await api.initiateDriveUpload({
      fileName,
      mimeType: ImageMimeType.PNG,
      sizeBytes: blob.size,
      resourceType: ResourceType.SCREENSHOT,
    });
    const res = await fetchPut(sessionUri, blob, { "Content-Type": ImageMimeType.PNG });
    storageFileId = ((await res.json()) as { id: string }).id;
  } else if (destination === StorageProvider.DROPBOX) {
    const { accessToken, path } = await api.initiateDropboxUpload({
      fileName,
      mimeType: ImageMimeType.PNG,
      sizeBytes: blob.size,
      resourceType: ResourceType.SCREENSHOT,
    });
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({ path, mode: "add", autorename: true, mute: true }),
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    });
    if (!res.ok) throw new Error(`Dropbox upload failed (${res.status})`);
    storageFileId = ((await res.json()) as { path_lower?: string }).path_lower ?? path;
  } else {
    const { signedUrl, path } = await api.initiateServerUpload({
      fileName,
      mimeType: ImageMimeType.PNG,
      sizeBytes: blob.size,
      resourceType: ResourceType.SCREENSHOT,
    });
    await fetchPut(signedUrl, blob, { "Content-Type": ImageMimeType.PNG, "x-upsert": "true" });
    storageFileId = path;
  }

  const { screenshot } = await api.createScreenshot({
    title,
    size: blob.size,
    mimeType: ImageMimeType.PNG,
    storageProvider: destination,
    storageFileId,
  });

  const { shareUrl } = await api.createShare({
    resourceType: ResourceType.SCREENSHOT,
    resourceId: screenshot.id,
    permission: SharePermission.VIEW,
  });

  await addRecent({
    id: screenshot.id,
    title,
    type: "screenshot",
    provider: destination,
    shareUrl,
    createdAt: Date.now(),
  });

  return { mediaId: screenshot.id, shareUrl, provider: destination };
}
