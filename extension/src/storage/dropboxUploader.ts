/**
 * Direct-to-Dropbox upload. The backend relayed a short-lived access token + target
 * path; we POST the bytes straight to Dropbox's content API (with XHR progress).
 * Returns the final Dropbox path (Dropbox may autorename on collision).
 */
import { xhrUpload } from "./xhrUpload.js";

export async function uploadToDropbox(params: {
  accessToken: string;
  path: string;
  blob: Blob;
  onProgress?: (fraction: number) => void;
}): Promise<{ path: string }> {
  const { accessToken, path, blob, onProgress } = params;
  const arg = JSON.stringify({ path, mode: "add", autorename: true, mute: true });
  const result = await xhrUpload({
    url: "https://content.dropboxapi.com/2/files/upload",
    method: "POST",
    body: blob,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": arg,
      "Content-Type": "application/octet-stream",
    },
    onProgress,
  });
  try {
    const meta = JSON.parse(result.responseText) as { path_lower?: string; path_display?: string };
    return { path: meta.path_lower ?? meta.path_display ?? path };
  } catch {
    return { path };
  }
}
