/**
 * Prisma row → API DTO mappers. The single place rows become wire shapes: dates to
 * ISO strings, BigInt sizes to numbers, secrets dropped. Keeps responses consistent
 * and prevents accidental leakage of sensitive columns.
 */
import type { Recording, Screenshot, StorageConnection, User } from "@prisma/client";
import {
  LinkVisibility,
  ResourceType,
  StorageProvider,
  type RecordingDTO,
  type ScreenshotDTO,
  type StorageConnectionDTO,
  type UserDTO,
} from "@flowcap/shared";
import { resolveEntitlements } from "./entitlements.js";

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    plan: u.plan,
    entitlements: resolveEntitlements(u.plan),
    createdAt: u.createdAt.toISOString(),
  };
}

export function toStorageConnectionDTO(c: StorageConnection): StorageConnectionDTO {
  return {
    id: c.id,
    provider: c.provider,
    driveEmail: c.driveEmail,
    defaultFolderId: c.defaultFolderId,
    isActive: c.isActive,
    isDefault: c.isDefault,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toRecordingDTO(r: Recording): RecordingDTO {
  return {
    resourceType: ResourceType.RECORDING,
    id: r.id,
    title: r.title,
    description: r.description,
    duration: r.duration,
    size: Number(r.size),
    mimeType: r.mimeType as RecordingDTO["mimeType"],
    storageProvider: r.storageProvider,
    storageFileId: r.storageFileId,
    thumbnailUrl: r.thumbnailUrl,
    workspaceId: r.workspaceId,
    trimStartSec: r.trimStartSec,
    trimEndSec: r.trimEndSec,
    cuts: (r.cuts as unknown as RecordingDTO["cuts"]) ?? null,
    shareToken: r.shareToken,
    isPublic: r.isPublic,
    visibility: r.isPublic ? LinkVisibility.PUBLIC : LinkVisibility.PRIVATE,
    viewCount: r.viewCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toScreenshotDTO(s: Screenshot): ScreenshotDTO {
  return {
    resourceType: ResourceType.SCREENSHOT,
    id: s.id,
    title: s.title,
    size: Number(s.size),
    mimeType: s.mimeType as ScreenshotDTO["mimeType"],
    storageProvider: s.storageProvider,
    storageFileId: s.storageFileId,
    thumbnailUrl: s.thumbnailUrl,
    workspaceId: s.workspaceId,
    shareToken: s.shareToken,
    isPublic: s.isPublic,
    visibility: s.isPublic ? LinkVisibility.PUBLIC : LinkVisibility.PRIVATE,
    viewCount: s.viewCount,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Re-export for callers that only need the enum at the boundary. */
export { StorageProvider };
