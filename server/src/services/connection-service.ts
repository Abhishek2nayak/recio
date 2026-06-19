/**
 * StorageConnection bookkeeping: persisting (encrypted) Drive tokens, resolving the
 * user's default upload destination, and flipping which provider is default.
 * Drive tokens are AES-256-GCM encrypted via `crypto.ts` — never stored plaintext.
 */
import type { StorageConnection } from "@prisma/client";
import { ErrorCode, StorageProvider } from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";
import { encryptSecret } from "../lib/crypto.js";
import { HttpError } from "../lib/http-error.js";
import type { DriveTokens } from "./google-oauth.js";

export function listConnections(userId: string): Promise<StorageConnection[]> {
  return prisma.storageConnection.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/** The provider new uploads default to (the row flagged `isDefault`, else FLOWCAP). */
export async function getDefaultProvider(userId: string): Promise<StorageProvider> {
  const def = await prisma.storageConnection.findFirst({
    where: { userId, isDefault: true, isActive: true },
  });
  return def?.provider ?? StorageProvider.FLOWCAP;
}

/** Load the active Drive connection or fail with a clear, structured error. */
export async function requireDriveConnection(userId: string): Promise<StorageConnection> {
  return requireConnection(userId, StorageProvider.DRIVE);
}

/**
 * Flag a connection as broken (refresh token revoked/expired). The row is kept so
 * the UI can show "reconnect" instead of "connect", and so the account email is
 * still known for the reconnect-same-account check.
 */
export async function markConnectionBroken(connectionId: string): Promise<void> {
  await prisma.storageConnection
    .update({ where: { id: connectionId }, data: { isActive: false } })
    .catch(() => {}); // already deleted → nothing to mark
}

/**
 * Save (or refresh) the Drive connection after an OAuth exchange. Google only
 * returns a refresh token on first consent, so we keep the existing one if absent.
 */
export async function saveDriveConnection(userId: string, tokens: DriveTokens): Promise<StorageConnection> {
  const existing = await prisma.storageConnection.findUnique({
    where: { userId_provider: { userId, provider: StorageProvider.DRIVE } },
  });
  assertSameAccount(existing, tokens.email, "Google Drive");

  const encryptedRefresh = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : existing?.refreshToken ?? null;

  if (!encryptedRefresh) {
    throw new HttpError(
      ErrorCode.DRIVE_AUTH_FAILED,
      "Google did not return a refresh token. Disconnect and reconnect, granting offline access.",
    );
  }

  const data = {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken: encryptedRefresh,
    expiresAt: tokens.expiryDate,
    driveEmail: tokens.email ?? existing?.driveEmail ?? null,
    isActive: true,
  };

  return prisma.storageConnection.upsert({
    where: { userId_provider: { userId, provider: StorageProvider.DRIVE } },
    update: data,
    create: { userId, provider: StorageProvider.DRIVE, ...data },
  });
}

/** Persist a freshly refreshed Drive access token (called from the Drive client hook). */
export async function updateDriveAccessToken(
  connectionId: string,
  accessToken: string,
  expiresAt: Date | null,
): Promise<void> {
  await prisma.storageConnection.update({
    where: { id: connectionId },
    data: { accessToken: encryptSecret(accessToken), expiresAt },
  });
}

export async function setDriveFolderId(connectionId: string, folderId: string | null): Promise<void> {
  await prisma.storageConnection.update({
    where: { id: connectionId },
    data: { defaultFolderId: folderId },
  });
}

export async function disconnectDrive(userId: string): Promise<void> {
  await prisma.storageConnection.deleteMany({
    where: { userId, provider: StorageProvider.DRIVE },
  });
  // If Drive was the default, fall back to FLOWCAP.
  await prisma.storageConnection.updateMany({
    where: { userId, provider: StorageProvider.FLOWCAP },
    data: { isDefault: true },
  });
}

/**
 * Refuse a silent account swap. Files already saved live in the OLD account; if we
 * quietly switched tokens, every existing recording (and every shared link) would
 * 404 because the new account can't read the old account's files. The user must
 * disconnect explicitly first — the disconnect UI spells out the consequences.
 */
function assertSameAccount(
  existing: StorageConnection | null,
  newEmail: string | null,
  providerLabel: string,
): void {
  if (!existing?.driveEmail || !newEmail) return;
  if (existing.driveEmail.toLowerCase() === newEmail.toLowerCase()) return;
  throw new HttpError(
    ErrorCode.STORAGE_ACCOUNT_MISMATCH,
    `${providerLabel} is already connected as ${existing.driveEmail}, but you authorized ${newEmail}. ` +
      `Recordings already saved there would stop playing if we switched accounts. ` +
      `Reconnect with ${existing.driveEmail}, or disconnect it first to switch.`,
  );
}

/** Generic OAuth token bundle (Drive + Dropbox share the same shape). */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: Date | null;
  email: string | null;
}

/**
 * Load the connection for a provider, or fail clearly. Distinguishes "never
 * connected" from "connected but broken" (revoked/expired grant) so clients can
 * show a reconnect prompt instead of a generic connect button.
 */
export async function requireConnection(
  userId: string,
  provider: StorageProvider,
): Promise<StorageConnection> {
  const conn = await prisma.storageConnection.findFirst({ where: { userId, provider } });
  if (!conn?.refreshToken) {
    throw new HttpError(ErrorCode.STORAGE_NOT_CONNECTED, `${provider} is not connected.`);
  }
  if (!conn.isActive) {
    throw new HttpError(
      ErrorCode.STORAGE_RECONNECT_REQUIRED,
      `Access to ${provider} was revoked or expired. Reconnect it in Settings.`,
    );
  }
  return conn;
}

/** Save (or refresh) the Dropbox connection after an OAuth exchange. */
export async function saveDropboxConnection(
  userId: string,
  tokens: OAuthTokens,
): Promise<StorageConnection> {
  const existing = await prisma.storageConnection.findUnique({
    where: { userId_provider: { userId, provider: StorageProvider.DROPBOX } },
  });
  assertSameAccount(existing, tokens.email, "Dropbox");
  const encryptedRefresh = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : existing?.refreshToken ?? null;
  if (!encryptedRefresh) {
    throw new HttpError(
      ErrorCode.DRIVE_AUTH_FAILED,
      "Dropbox did not return a refresh token. Disconnect and reconnect.",
    );
  }
  const data = {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken: encryptedRefresh,
    expiresAt: tokens.expiryDate,
    driveEmail: tokens.email ?? existing?.driveEmail ?? null, // reused as the account email
    isActive: true,
  };
  return prisma.storageConnection.upsert({
    where: { userId_provider: { userId, provider: StorageProvider.DROPBOX } },
    update: data,
    create: { userId, provider: StorageProvider.DROPBOX, ...data },
  });
}

/** Disconnect any provider; falls back to FLOWCAP as default. */
export async function disconnectProvider(userId: string, provider: StorageProvider): Promise<void> {
  await prisma.storageConnection.deleteMany({ where: { userId, provider } });
  await prisma.storageConnection.updateMany({
    where: { userId, provider: StorageProvider.FLOWCAP },
    data: { isDefault: true },
  });
}

/** Make `provider` the sole default for the user. */
export async function setDefaultProvider(userId: string, provider: StorageProvider): Promise<void> {
  const target = await prisma.storageConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!target?.isActive) {
    throw new HttpError(ErrorCode.STORAGE_NOT_CONNECTED, `${provider} is not connected.`);
  }
  await prisma.$transaction([
    prisma.storageConnection.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.storageConnection.update({ where: { id: target.id }, data: { isDefault: true } }),
  ]);
}
