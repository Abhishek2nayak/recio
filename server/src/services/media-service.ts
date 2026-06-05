/**
 * Media (Recording + Screenshot) queries. Centralizes cursor pagination, the
 * dashboard filter/sort/search, owner-scoped lookups, and soft delete so the route
 * handlers stay thin. Soft-deleted rows (`deletedAt != null`) are always excluded.
 */
import type { Prisma, Recording, Screenshot } from "@prisma/client";
import {
  ResourceType,
  StorageProvider,
  type CreateRecordingInput,
  type CreateScreenshotInput,
  type ListMediaQuery,
  type UpdateMediaInput,
} from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { deleteStoredObject, setPublicAccess } from "./storage-service.js";

type Order = Prisma.RecordingOrderByWithRelationInput[];

function orderFor(sort: ListMediaQuery["sort"]): Order {
  switch (sort) {
    case "OLDEST":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "NAME":
      return [{ title: "asc" }, { id: "asc" }];
    case "SIZE":
      return [{ size: "desc" }, { id: "desc" }];
    case "NEWEST":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/** Provider filter from the dashboard chips; RECORDINGS/SCREENSHOTS/ALL don't constrain provider. */
function providerFilter(filter: ListMediaQuery["filter"]): StorageProvider | undefined {
  if (filter === "DRIVE") return StorageProvider.DRIVE;
  if (filter === "FLOWCAP") return StorageProvider.FLOWCAP;
  return undefined;
}

function whereFor(userId: string, query: ListMediaQuery) {
  const provider = providerFilter(query.filter);
  return {
    userId,
    deletedAt: null,
    ...(provider ? { storageProvider: provider } : {}),
    ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
  };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Shared cursor pagination: fetch limit+1, peel the extra to compute `nextCursor`. */
function paginate<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: items[items.length - 1]!.id };
  }
  return { items: rows, nextCursor: null };
}

function cursorArgs(cursor?: string): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

export async function listRecordings(userId: string, query: ListMediaQuery): Promise<Page<Recording>> {
  const rows = await prisma.recording.findMany({
    where: whereFor(userId, query),
    orderBy: orderFor(query.sort),
    take: query.limit + 1,
    ...cursorArgs(query.cursor),
  });
  return paginate(rows, query.limit);
}

export async function listScreenshots(userId: string, query: ListMediaQuery): Promise<Page<Screenshot>> {
  const rows = await prisma.screenshot.findMany({
    where: whereFor(userId, query),
    orderBy: orderFor(query.sort) as Prisma.ScreenshotOrderByWithRelationInput[],
    take: query.limit + 1,
    ...cursorArgs(query.cursor),
  });
  return paginate(rows, query.limit);
}

export function findOwnedRecording(userId: string, id: string): Promise<Recording | null> {
  return prisma.recording.findFirst({ where: { id, userId, deletedAt: null } });
}

export function findOwnedScreenshot(userId: string, id: string): Promise<Screenshot | null> {
  return prisma.screenshot.findFirst({ where: { id, userId, deletedAt: null } });
}

/** Fetch a live (non-deleted) media row by resource type + id, regardless of owner. */
export async function findMediaByResource(
  resourceType: ResourceType,
  resourceId: string,
): Promise<Recording | Screenshot | null> {
  return resourceType === ResourceType.RECORDING
    ? prisma.recording.findFirst({ where: { id: resourceId, deletedAt: null } })
    : prisma.screenshot.findFirst({ where: { id: resourceId, deletedAt: null } });
}

/** Fetch an owned media row (recording OR screenshot) by id — used by the stream proxy. */
export async function findOwnedMediaById(
  userId: string,
  id: string,
): Promise<Recording | Screenshot | null> {
  const recording = await findOwnedRecording(userId, id);
  if (recording) return recording;
  return findOwnedScreenshot(userId, id);
}

/** Resolve a public media row by its share token (used by the public share route). */
export async function findByShareToken(
  token: string,
): Promise<{ media: Recording | Screenshot; type: ResourceType } | null> {
  const recording = await prisma.recording.findFirst({ where: { shareToken: token, deletedAt: null } });
  if (recording) return { media: recording, type: ResourceType.RECORDING };
  const screenshot = await prisma.screenshot.findFirst({ where: { shareToken: token, deletedAt: null } });
  if (screenshot) return { media: screenshot, type: ResourceType.SCREENSHOT };
  return null;
}

export async function incrementViewCount(type: ResourceType, id: string): Promise<void> {
  if (type === ResourceType.RECORDING) {
    await prisma.recording.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  } else {
    await prisma.screenshot.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }
}

// ── Mutations ───────────────────────────────────────────────────────────────

export function createRecording(userId: string, input: CreateRecordingInput): Promise<Recording> {
  return prisma.recording.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      duration: input.duration,
      size: BigInt(input.size),
      mimeType: input.mimeType,
      storageProvider: input.storageProvider,
      storageFileId: input.storageFileId,
      thumbnailUrl: input.thumbnailUrl ?? null,
    },
  });
}

export function createScreenshot(userId: string, input: CreateScreenshotInput): Promise<Screenshot> {
  return prisma.screenshot.create({
    data: {
      userId,
      title: input.title,
      size: BigInt(input.size),
      mimeType: input.mimeType,
      storageProvider: input.storageProvider,
      storageFileId: input.storageFileId,
      thumbnailUrl: input.thumbnailUrl ?? null,
    },
  });
}

/**
 * Apply a visibility change to owned media: toggles the underlying storage ACL
 * (Drive "anyone with link") FIRST, then records `isPublic`. If the storage call
 * fails we don't lie about the DB state.
 */
export async function setMediaVisibility(
  userId: string,
  type: ResourceType,
  id: string,
  isPublic: boolean,
): Promise<Recording | Screenshot> {
  const media =
    type === ResourceType.RECORDING
      ? await findOwnedRecording(userId, id)
      : await findOwnedScreenshot(userId, id);
  if (!media) throw HttpError.notFound("Media not found.");

  await setPublicAccess(userId, media.storageProvider, media.storageFileId, isPublic);

  return type === ResourceType.RECORDING
    ? prisma.recording.update({ where: { id }, data: { isPublic } })
    : prisma.screenshot.update({ where: { id }, data: { isPublic } });
}

/** Update title/description and (with the ACL side-effect) visibility. */
export async function updateRecording(
  userId: string,
  id: string,
  input: UpdateMediaInput,
): Promise<Recording> {
  const existing = await findOwnedRecording(userId, id);
  if (!existing) throw HttpError.notFound("Recording not found.");
  if (input.isPublic !== undefined && input.isPublic !== existing.isPublic) {
    await setPublicAccess(userId, existing.storageProvider, existing.storageFileId, input.isPublic);
  }
  return prisma.recording.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.trimStartSec !== undefined ? { trimStartSec: input.trimStartSec } : {}),
      ...(input.trimEndSec !== undefined ? { trimEndSec: input.trimEndSec } : {}),
    },
  });
}

export async function updateScreenshot(
  userId: string,
  id: string,
  input: UpdateMediaInput,
): Promise<Screenshot> {
  const existing = await findOwnedScreenshot(userId, id);
  if (!existing) throw HttpError.notFound("Screenshot not found.");
  if (input.isPublic !== undefined && input.isPublic !== existing.isPublic) {
    await setPublicAccess(userId, existing.storageProvider, existing.storageFileId, input.isPublic);
  }
  return prisma.screenshot.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    },
  });
}

/** Soft delete (sets `deletedAt`) and best-effort removes the underlying object. */
export async function softDeleteMedia(userId: string, type: ResourceType, id: string): Promise<void> {
  const media =
    type === ResourceType.RECORDING
      ? await findOwnedRecording(userId, id)
      : await findOwnedScreenshot(userId, id);
  if (!media) throw HttpError.notFound("Media not found.");

  // Stop here if storage deletion fails for Drive? We prefer to remove the object
  // but not block the user; swallow storage errors so the row is still soft-deleted.
  try {
    await deleteStoredObject(userId, media.storageProvider, media.storageFileId);
  } catch {
    /* best-effort */
  }

  if (type === ResourceType.RECORDING) {
    await prisma.recording.update({ where: { id }, data: { deletedAt: new Date() } });
  } else {
    await prisma.screenshot.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
