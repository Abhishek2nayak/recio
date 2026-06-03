/**
 * Provider-agnostic storage operations. Callers pass a provider + storage id and
 * this routes to Drive or Supabase — so routes never branch on provider themselves.
 */
import { StorageProvider } from "@flowcap/shared";
import * as drive from "./drive-service.js";
import { createSignedDownloadUrl, removeObject } from "./supabase-storage.js";

/** A playback URL: a Drive view URL, or a short-lived signed Supabase URL. */
export async function getPlaybackUrl(
  provider: StorageProvider,
  storageFileId: string,
): Promise<string> {
  if (provider === StorageProvider.DRIVE) return drive.driveViewUrl(storageFileId);
  return createSignedDownloadUrl(storageFileId);
}

/** Best-effort delete of the underlying object when media is removed. */
export async function deleteStoredObject(
  userId: string,
  provider: StorageProvider,
  storageFileId: string,
): Promise<void> {
  if (provider === StorageProvider.DRIVE) {
    await drive.deleteFile(userId, storageFileId);
  } else {
    await removeObject(storageFileId);
  }
}

/**
 * Apply a visibility change at the storage layer. For Drive this toggles the
 * "anyone with link" permission. For Supabase-backed media there's nothing to do —
 * privacy is enforced by whether we hand out a signed/public URL at view time.
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
