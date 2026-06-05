/**
 * Provider-agnostic storage operations. Callers pass a provider + storage id and
 * this routes to Drive or Supabase — so routes never branch on provider themselves.
 */
import { ErrorCode, StorageProvider } from "@flowcap/shared";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { signPlaybackToken } from "../lib/jwt.js";
import * as drive from "./drive-service.js";
import * as dropbox from "./dropbox-service.js";
import { createSignedDownloadUrl, removeObject } from "./supabase-storage.js";

/** Absolute URL of our own Range-capable proxy for a Drive-backed item. */
function driveStreamUrl(ownerId: string, mediaId: string): string {
  const token = signPlaybackToken(ownerId, mediaId);
  return `${env.API_PUBLIC_URL}/media/${mediaId}/stream?t=${token}`;
}

/**
 * A playback URL the browser can load directly. Drive items go through our own
 * streaming proxy (so a native <video> plays the original bytes — Drive's preview
 * transcoder is unreliable for webm); Dropbox/Supabase hand back their own direct
 * (temporary/signed) URLs.
 */
export async function getPlaybackUrl(
  userId: string,
  provider: StorageProvider,
  storageFileId: string,
  mediaId: string,
): Promise<string> {
  if (provider === StorageProvider.DRIVE) return driveStreamUrl(userId, mediaId);
  if (provider === StorageProvider.DROPBOX) return dropbox.getTemporaryLink(userId, storageFileId);
  return createSignedDownloadUrl(storageFileId);
}

/** Stream a Drive-backed item's bytes through the proxy (Range-aware). */
export async function streamMedia(
  ownerId: string,
  provider: StorageProvider,
  storageFileId: string,
  range?: string,
): Promise<drive.DriveStream> {
  if (provider !== StorageProvider.DRIVE) {
    // Dropbox/Supabase are served via direct URLs, never through this proxy.
    throw new HttpError(ErrorCode.INTERNAL_ERROR, "Streaming proxy only supports Drive-backed media.");
  }
  return drive.streamFile(ownerId, storageFileId, range);
}

/** Best-effort delete of the underlying object when media is removed. */
export async function deleteStoredObject(
  userId: string,
  provider: StorageProvider,
  storageFileId: string,
): Promise<void> {
  if (provider === StorageProvider.DRIVE) {
    await drive.deleteFile(userId, storageFileId);
  } else if (provider === StorageProvider.DROPBOX) {
    await dropbox.deleteFile(userId, storageFileId);
  } else {
    await removeObject(storageFileId);
  }
}

/**
 * Apply a visibility change at the storage layer. Drive toggles the "anyone with
 * link" permission. Dropbox + Supabase don't need it — privacy is enforced by
 * whether we hand out a (temporary/signed) URL at view time, gated by `isPublic`.
 */
export async function setPublicAccess(
  userId: string,
  provider: StorageProvider,
  storageFileId: string,
  isPublic: boolean,
): Promise<void> {
  if (provider !== StorageProvider.DRIVE) return;
  if (isPublic) await drive.setPublicPermission(userId, storageFileId);
  else await drive.removePublicPermission(userId, storageFileId);
}
