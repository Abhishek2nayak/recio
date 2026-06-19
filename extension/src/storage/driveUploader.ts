/**
 * Direct-to-Drive upload over Google's resumable protocol. The backend opened the
 * session and handed us the session URI (self-authorizing — no token here); we PUT
 * the bytes straight to Google.
 *
 * Unlike a single-shot PUT, this uses the protocol's actual recovery: when a chunk
 * attempt dies (network drop, sleep/wake, 5xx), we ask the session how much it
 * received (`PUT` with `Content-Range: bytes *​/total` → 308 + `Range` header) and
 * resume from that offset with exponential backoff. The final response carries the
 * Drive file id.
 */
import { UploadHttpError, xhrUpload } from "./xhrUpload.js";

const MAX_ATTEMPTS = 6;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Probe =
  | { state: "open"; offset: number }
  | { state: "done"; fileId: string }
  | { state: "gone" };

/** Ask the session where it stopped. 308 = still open, 2xx = complete, 404 = expired. */
async function probeSession(sessionUri: string, total: number): Promise<Probe> {
  let res: Response;
  try {
    res = await fetch(sessionUri, {
      method: "PUT",
      headers: { "Content-Range": `bytes */${total}` },
    });
  } catch {
    return { state: "open", offset: 0 }; // probe itself failed (offline) — retry from scratch
  }
  if (res.status === 308) {
    // "Range: bytes=0-N" → N+1 bytes stored; header absent → nothing stored yet.
    const m = res.headers.get("Range")?.match(/-(\d+)$/);
    return { state: "open", offset: m ? Number(m[1]) + 1 : 0 };
  }
  if (res.ok) {
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    if (data?.id) return { state: "done", fileId: data.id };
  }
  return { state: "gone" };
}

function parseFileId(responseText: string): string {
  const fileId = (JSON.parse(responseText) as { id?: string }).id;
  if (!fileId) throw new Error("Could not read the Drive file id from the upload response.");
  return fileId;
}

export async function uploadToDrive(params: {
  sessionUri: string;
  blob: Blob;
  mimeType: string;
  onProgress?: (fraction: number) => void;
}): Promise<{ fileId: string }> {
  const { sessionUri, blob, mimeType, onProgress } = params;
  const total = blob.size;
  let offset = 0;

  for (let attempt = 1; ; attempt++) {
    try {
      const slice = offset > 0 ? blob.slice(offset) : blob;
      const headers: Record<string, string> = { "Content-Type": mimeType };
      if (offset > 0) headers["Content-Range"] = `bytes ${offset}-${total - 1}/${total}`;

      const result = await xhrUpload({
        url: sessionUri,
        method: "PUT",
        body: slice,
        headers,
        onProgress: (f) => onProgress?.((offset + f * slice.size) / total),
      });
      return { fileId: parseFileId(result.responseText) };
    } catch (err) {
      const retryable = err instanceof UploadHttpError && err.retryable;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw err;

      await wait(Math.min(1000 * 2 ** (attempt - 1), 16_000));
      const probe = await probeSession(sessionUri, total);
      if (probe.state === "done") return { fileId: probe.fileId }; // it landed after all
      if (probe.state === "gone") {
        throw new UploadHttpError(404, "", "The Drive upload session expired. Retry to start a fresh upload.");
      }
      offset = probe.offset;
      onProgress?.(offset / total);
    }
  }
}
