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
  const conn = await prisma.storageConnection.findFirst({
    where: { userId, provider: StorageProvider.DRIVE, isActive: true },
  });
  if (!conn?.refreshToken) {
    throw new HttpError(ErrorCode.STORAGE_NOT_CONNECTED, "Google Drive is not connected.");
  }
  return conn;
}

/**
 * Save (or refresh) the Drive connection after an OAuth exchange. Google only
 * returns a refresh token on first consent, so we keep the existing one if absent.
 */
export async function saveDriveConnection(userId: string, tokens: DriveTokens): Promise<StorageConnection> {
  const existing = await prisma.storageConnection.findUnique({
    where: { userId_provider: { userId, provider: StorageProvider.DRIVE } },
  });

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

export async function setDriveFolderId(connectionId: string, folderId: string): Promise<void> {
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
