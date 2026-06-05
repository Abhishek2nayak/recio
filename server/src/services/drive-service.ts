/**
 * Server-side Google Drive operations using the user's stored (encrypted) tokens.
 *
 * The heavy upload bytes never touch this server: we only OPEN a resumable session
 * (authorized with the user's token) and hand the opaque session URI to the client,
 * which PUTs the file straight to Drive. Everything else here — folder creation,
 * the "anyone with link" permission toggle, deletion — is lightweight metadata work.
 */
import type { Readable } from "node:stream";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { DRIVE_ROOT_FOLDER_NAME, ErrorCode } from "@flowcap/shared";
import type { StorageConnection } from "@prisma/client";
import { env } from "../config/env.js";
import { decryptSecret } from "../lib/crypto.js";
import { HttpError } from "../lib/http-error.js";
import {
  requireDriveConnection,
  setDriveFolderId,
  updateDriveAccessToken,
} from "./connection-service.js";

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

/** Build an OAuth2 client primed with the connection's tokens; persist refreshes. */
function buildClient(conn: StorageConnection): OAuth2Client {
  const client = new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  });
  client.setCredentials({
    access_token: conn.accessToken ? decryptSecret(conn.accessToken) : undefined,
    refresh_token: conn.refreshToken ? decryptSecret(conn.refreshToken) : undefined,
    expiry_date: conn.expiresAt?.getTime(),
  });
  // google-auth-library auto-refreshes the access token; persist it (re-encrypted).
  client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      void updateDriveAccessToken(
        conn.id,
        tokens.access_token,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      );
    }
  });
  return client;
}

async function getClient(userId: string): Promise<{ client: OAuth2Client; conn: StorageConnection }> {
  const conn = await requireDriveConnection(userId);
  return { client: buildClient(conn), conn };
}

/** Find (or create) the user's Recio folder, caching its id on the connection. */
async function ensureFolder(
  client: OAuth2Client,
  conn: StorageConnection,
): Promise<string> {
  if (conn.defaultFolderId) return conn.defaultFolderId;

  const drive = google.drive({ version: "v3", auth: client });
  const q = [
    `name='${DRIVE_ROOT_FOLDER_NAME.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");

  const existing = await drive.files.list({ q, fields: "files(id)", spaces: "drive" });
  const found = existing.data.files?.[0]?.id;
  if (found) {
    await setDriveFolderId(conn.id, found);
    return found;
  }

  const created = await drive.files.create({
    requestBody: { name: DRIVE_ROOT_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  const id = created.data.id;
  if (!id) throw new HttpError(ErrorCode.DRIVE_API_ERROR, "Could not create the Recio folder.");
  await setDriveFolderId(conn.id, id);
  return id;
}

export interface ResumableSession {
  sessionUri: string;
  folderId: string;
}

/**
 * Open a Drive resumable upload session and return the session URI. The client PUTs
 * the bytes directly to this URI (the URI is self-authorizing — no token needed),
 * then reads the Drive file id from the final response.
 */
export async function initiateResumableUpload(
  userId: string,
  params: { fileName: string; mimeType: string },
): Promise<ResumableSession> {
  const { client, conn } = await getClient(userId);
  const folderId = await ensureFolder(client, conn);

  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "No Drive access token.");

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": params.mimeType,
    },
    body: JSON.stringify({ name: params.fileName, parents: [folderId], mimeType: params.mimeType }),
  });
  if (!res.ok) {
    throw new HttpError(ErrorCode.UPLOAD_FAILED, `Drive session init failed (${res.status}).`);
  }
  const sessionUri = res.headers.get("location");
  if (!sessionUri) throw new HttpError(ErrorCode.UPLOAD_FAILED, "Drive returned no session URI.");

  return { sessionUri, folderId };
}

/** Make a Drive file readable by "anyone with the link". */
export async function setPublicPermission(userId: string, fileId: string): Promise<void> {
  const { client } = await getClient(userId);
  const drive = google.drive({ version: "v3", auth: client });
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone", allowFileDiscovery: false },
    });
  } catch (err) {
    throw new HttpError(ErrorCode.DRIVE_API_ERROR, `Could not make the file public: ${asMsg(err)}`);
  }
}

/** Revoke the "anyone" permission, making the file private again. */
export async function removePublicPermission(userId: string, fileId: string): Promise<void> {
  const { client } = await getClient(userId);
  const drive = google.drive({ version: "v3", auth: client });
  const perms = await drive.permissions.list({ fileId, fields: "permissions(id,type)" });
  const anyone = perms.data.permissions?.find((p) => p.type === "anyone");
  if (anyone?.id) {
    await drive.permissions.delete({ fileId, permissionId: anyone.id });
  }
}

export async function deleteFile(userId: string, fileId: string): Promise<void> {
  const { client } = await getClient(userId);
  const drive = google.drive({ version: "v3", auth: client });
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    // Already gone is fine; surface anything else.
    if (!String(asMsg(err)).includes("404")) {
      throw new HttpError(ErrorCode.DRIVE_API_ERROR, `Could not delete the Drive file: ${asMsg(err)}`);
    }
  }
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export interface DriveStream {
  stream: Readable;
  status: number;
  headers: Record<string, string>;
}

/**
 * Stream a Drive file's RAW bytes (alt=media), forwarding the caller's Range header
 * so the browser can seek. This is what backs playback: we serve the original webm
 * to a native <video> element instead of relying on Drive's preview transcoder,
 * which is flaky for MediaRecorder webm (no Cues/duration index) and lags while
 * Drive "processes" a freshly uploaded file.
 */
export async function streamFile(
  userId: string,
  fileId: string,
  range?: string,
): Promise<DriveStream> {
  const { client } = await getClient(userId);
  const drive = google.drive({ version: "v3", auth: client });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream", headers: range ? { Range: range } : {} },
  );

  const headers: Record<string, string> = { "accept-ranges": "bytes" };
  const src = res.headers as Record<string, unknown>;
  for (const key of ["content-type", "content-length", "content-range"]) {
    const v = src[key];
    if (v != null) headers[key] = String(v);
  }
  return { stream: res.data as unknown as Readable, status: res.status, headers };
}

/** Best-effort Drive quota (bytes). Returns null if it can't be fetched. */
export async function getStorageQuota(
  userId: string,
): Promise<{ used: number; limit: number | null } | null> {
  try {
    const { client } = await getClient(userId);
    const drive = google.drive({ version: "v3", auth: client });
    const about = await drive.about.get({ fields: "storageQuota" });
    const q = about.data.storageQuota;
    if (!q) return null;
    return {
      used: Number(q.usage ?? 0),
      limit: q.limit ? Number(q.limit) : null, // unlimited (e.g. Workspace) → null
    };
  } catch {
    return null;
  }
}

function asMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
