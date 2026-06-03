/**
 * Direct-to-Supabase upload via a signed upload URL the backend minted. We PUT the
 * bytes straight to Supabase Storage; the object key (`path`) was decided server-side
 * and is what we record as the media's storageFileId.
 */
import { xhrUpload } from "./xhrUpload.js";

export async function uploadToServer(params: {
  signedUrl: string;
  blob: Blob;
  mimeType: string;
  onProgress?: (fraction: number) => void;
}): Promise<void> {
  const { signedUrl, blob, mimeType, onProgress } = params;
  await xhrUpload({
    url: signedUrl,
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType, "x-upsert": "true" },
    onProgress,
  });
}
