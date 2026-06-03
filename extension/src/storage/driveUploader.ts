/**
 * Direct-to-Drive upload. The backend opened a resumable session and handed us the
 * session URI; we PUT the bytes straight to Google (the URI is self-authorizing, so
 * no token is attached here). The final response carries the Drive file id.
 * Ported from the legacy extension's Drive uploader.
 */
import { xhrUpload } from "./xhrUpload.js";

export async function uploadToDrive(params: {
  sessionUri: string;
  blob: Blob;
  mimeType: string;
  onProgress?: (fraction: number) => void;
}): Promise<{ fileId: string }> {
  const { sessionUri, blob, mimeType, onProgress } = params;
  const result = await xhrUpload({
    url: sessionUri,
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType },
    onProgress,
  });
  try {
    const fileId = (JSON.parse(result.responseText) as { id: string }).id;
    if (!fileId) throw new Error("missing id");
    return { fileId };
  } catch {
    throw new Error("Could not read the Drive file id from the upload response.");
  }
}
