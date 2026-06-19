/**
 * Server-side Dropbox operations using the user's stored (encrypted) tokens.
 *
 * Dropbox uploads need the access token in the request header (no self-authorizing
 * upload URL like Drive's resumable session), so for direct-to-Dropbox uploads we
 * relay a freshly-refreshed, short-lived access token to the extension, which then
 * uploads straight to Dropbox. Playback uses a temporary link; "anyone with link"
 * uses a Dropbox shared link.
 */
import { ErrorCode, StorageProvider } from "@flowcap/shared";
import type { StorageConnection } from "@prisma/client";
import { env } from "../config/env.js";
import { decryptSecret } from "../lib/crypto.js";
import { HttpError } from "../lib/http-error.js";
import {
  markConnectionBroken,
  requireConnection,
  updateDriveAccessToken,
  type OAuthTokens,
} from "./connection-service.js";

const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API = "https://api.dropboxapi.com/2";

export function dropboxConfigured(): boolean {
  return env.DROPBOX_CLIENT_ID.length > 0 && env.DROPBOX_CLIENT_SECRET.length > 0;
}

function basicAuth(): string {
  return Buffer.from(`${env.DROPBOX_CLIENT_ID}:${env.DROPBOX_CLIENT_SECRET}`).toString("base64");
}

/** Build the consent URL (offline access → refresh token). */
export function buildDropboxConsentUrl(state: string): string {
  return (
    "https://www.dropbox.com/oauth2/authorize?" +
    new URLSearchParams({
      client_id: env.DROPBOX_CLIENT_ID,
      response_type: "code",
      redirect_uri: env.DROPBOX_OAUTH_REDIRECT_URI,
      token_access_type: "offline",
      state,
    }).toString()
  );
}

async function getAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/users/get_current_account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/** Exchange an auth code for Dropbox tokens + the account email. */
export async function exchangeDropboxCode(code: string, redirectUri?: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth()}` },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri ?? env.DROPBOX_OAUTH_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Could not exchange the Dropbox auth code.");
  }
  const t = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiryDate: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
    email: await getAccountEmail(t.access_token),
  };
}

/** Return a valid (refreshed if needed) access token for the user, persisting refreshes. */
async function validAccessToken(conn: StorageConnection): Promise<string> {
  const notExpired = conn.expiresAt && conn.expiresAt.getTime() - 60_000 > Date.now();
  if (conn.accessToken && notExpired) return decryptSecret(conn.accessToken);

  if (!conn.refreshToken) throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "No Dropbox refresh token.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth()}` },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(conn.refreshToken),
    }),
  });
  if (res.status === 400 || res.status === 401) {
    // Refresh token revoked (app unlinked from dropbox.com) or invalid — flag the
    // connection so clients show "reconnect" instead of failing generically.
    await markConnectionBroken(conn.id);
    throw new HttpError(
      ErrorCode.STORAGE_RECONNECT_REQUIRED,
      "Dropbox access was revoked or expired. Reconnect Dropbox in Settings to keep recording and playing your videos.",
    );
  }
  if (!res.ok) throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Dropbox token refresh failed.");
  const t = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresAt = t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null;
  await updateDriveAccessToken(conn.id, t.access_token, expiresAt); // generic: persists by id
  return t.access_token;
}

export interface DropboxUploadGrant {
  /** Short-lived token the extension uses to upload directly to Dropbox. */
  accessToken: string;
  /** Destination path inside the user's Dropbox. */
  path: string;
}

/** Mint an upload grant: a fresh token + the target Dropbox path. */
export async function getUploadGrant(userId: string, fileName: string, folder: string): Promise<DropboxUploadGrant> {
  const conn = await requireConnection(userId, StorageProvider.DROPBOX);
  const accessToken = await validAccessToken(conn);
  const path = `/Recio/${folder}/${fileName}`;
  return { accessToken, path };
}

/** A direct, time-limited download link for playback. */
export async function getTemporaryLink(userId: string, path: string): Promise<string> {
  const conn = await requireConnection(userId, StorageProvider.DROPBOX);
  const accessToken = await validAccessToken(conn);
  const res = await fetch(`${API}/files/get_temporary_link`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new HttpError(ErrorCode.DRIVE_API_ERROR, "Could not get a Dropbox link.");
  return ((await res.json()) as { link: string }).link;
}

/** Create (or fetch) a public "anyone with the link" shared URL. */
export async function createSharedLink(userId: string, path: string): Promise<string> {
  const conn = await requireConnection(userId, StorageProvider.DROPBOX);
  const accessToken = await validAccessToken(conn);
  const res = await fetch(`${API}/sharing/create_shared_link_with_settings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (res.ok) return ((await res.json()) as { url: string }).url;

  // Already shared → fetch the existing link.
  const list = await fetch(`${API}/sharing/list_shared_links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path, direct_only: true }),
  });
  if (list.ok) {
    const links = ((await list.json()) as { links: { url: string }[] }).links;
    if (links[0]) return links[0].url;
  }
  throw new HttpError(ErrorCode.DRIVE_API_ERROR, "Could not create a Dropbox shared link.");
}

export async function revokeSharedLinks(userId: string, path: string): Promise<void> {
  const conn = await requireConnection(userId, StorageProvider.DROPBOX);
  const accessToken = await validAccessToken(conn);
  const list = await fetch(`${API}/sharing/list_shared_links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path, direct_only: true }),
  });
  if (!list.ok) return;
  const links = ((await list.json()) as { links: { url: string }[] }).links;
  for (const l of links) {
    await fetch(`${API}/sharing/revoke_shared_link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: l.url }),
    }).catch(() => {});
  }
}

export async function deleteFile(userId: string, path: string): Promise<void> {
  const conn = await requireConnection(userId, StorageProvider.DROPBOX);
  const accessToken = await validAccessToken(conn);
  await fetch(`${API}/files/delete_v2`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}
