/**
 * Direct-to-Dropbox upload. The backend relayed a short-lived access token + target
 * path; we send the bytes straight to Dropbox's content API (with XHR progress).
 *
 * Small files use single-shot `files/upload`. Anything bigger goes through
 * `upload_session/start → append_v2 → finish` — `files/upload` hard-caps at 150MB,
 * which a ~15 minute 1080p recording already exceeds. Each chunk retries with
 * backoff; on Dropbox's `incorrect_offset` we resume from its `correct_offset`, and
 * on 401 (the relayed token outlived a slow upload) we ask the caller for a fresh
 * one. Returns the final Dropbox path (Dropbox may autorename on collision).
 */
import { UploadHttpError, xhrUpload } from "./xhrUpload.js";

const CONTENT_API = "https://content.dropboxapi.com/2/files";
/** Single-shot below this (well under the 150MB files/upload cap). */
const SIMPLE_LIMIT = 32 * 1024 * 1024;
/** Session chunk size — a multiple of 4MB, per Dropbox's session rules. */
const CHUNK = 24 * 1024 * 1024;
const MAX_ATTEMPTS = 6;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface DropboxUploadParams {
  accessToken: string;
  path: string;
  blob: Blob;
  onProgress?: (fraction: number) => void;
  /** Called when the relayed token expires mid-upload; returns a fresh one. */
  refreshAccessToken?: () => Promise<string>;
}

interface UploadResultMeta {
  path_lower?: string;
  path_display?: string;
}

function commitArg(path: string): string {
  return JSON.stringify({ path, mode: "add", autorename: true, mute: true });
}

function finalPath(responseText: string, fallback: string): string {
  try {
    const meta = JSON.parse(responseText) as UploadResultMeta;
    return meta.path_lower ?? meta.path_display ?? fallback;
  } catch {
    return fallback;
  }
}

export async function uploadToDropbox(params: DropboxUploadParams): Promise<{ path: string }> {
  return params.blob.size <= SIMPLE_LIMIT ? uploadSimple(params) : uploadChunked(params);
}

async function uploadSimple(params: DropboxUploadParams): Promise<{ path: string }> {
  const send = (token: string) =>
    xhrUpload({
      url: `${CONTENT_API}/upload`,
      method: "POST",
      body: params.blob,
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": commitArg(params.path),
        "Content-Type": "application/octet-stream",
      },
      onProgress: params.onProgress,
    });

  let token = params.accessToken;
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await send(token);
      return { path: finalPath(result.responseText, params.path) };
    } catch (err) {
      if (err instanceof UploadHttpError && err.status === 401 && params.refreshAccessToken) {
        token = await params.refreshAccessToken();
        continue; // token swap doesn't count as an attempt
      }
      const retryable = err instanceof UploadHttpError && err.retryable;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw err;
      await wait(Math.min(1000 * 2 ** (attempt - 1), 16_000));
    }
  }
}

async function uploadChunked(params: DropboxUploadParams): Promise<{ path: string }> {
  const { blob, path, onProgress } = params;
  const total = blob.size;
  let token = params.accessToken;
  let sessionId: string | null = null;
  let offset = 0;

  /** One session call (start/append/finish) with retry, offset-recovery, and token refresh. */
  async function sessionCall(endpoint: string, arg: object, body: Blob): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await xhrUpload({
          url: `${CONTENT_API}/${endpoint}`,
          method: "POST",
          body,
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify(arg),
            "Content-Type": "application/octet-stream",
          },
          onProgress: (f) => onProgress?.((offset + f * body.size) / total),
        });
        return result.responseText;
      } catch (err) {
        if (!(err instanceof UploadHttpError)) throw err;
        if (err.status === 401 && params.refreshAccessToken) {
          token = await params.refreshAccessToken();
          continue;
        }
        // Dropbox tells us where the session actually is — trust it and resync.
        const m = err.responseText.match(/"correct_offset"\s*:\s*(\d+)/);
        if (m) {
          offset = Number(m[1]);
          throw new OffsetResync();
        }
        if (!err.retryable || attempt >= MAX_ATTEMPTS) throw err;
        await wait(Math.min(1000 * 2 ** (attempt - 1), 16_000));
      }
    }
  }

  while (true) {
    try {
      if (sessionId === null) {
        const first = blob.slice(0, Math.min(CHUNK, total));
        const res = await sessionCall("upload_session/start", { close: false }, first);
        sessionId = (JSON.parse(res) as { session_id: string }).session_id;
        offset = first.size;
        continue;
      }

      const remaining = total - offset;
      const cursor = { session_id: sessionId, offset };

      if (remaining <= CHUNK) {
        const last = blob.slice(offset, total);
        const res = await sessionCall("upload_session/finish", { cursor, commit: JSON.parse(commitArg(path)) as object }, last);
        return { path: finalPath(res, path) };
      }

      const chunk = blob.slice(offset, offset + CHUNK);
      await sessionCall("upload_session/append_v2", { cursor, close: false }, chunk);
      offset += chunk.size;
    } catch (err) {
      if (err instanceof OffsetResync) continue; // offset was corrected — go again from there
      throw err;
    }
  }
}

/** Internal signal: Dropbox reported the session's true offset; resume from it. */
class OffsetResync extends Error {
  constructor() {
    super("resync");
  }
}
