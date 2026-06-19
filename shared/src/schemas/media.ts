import { z } from "zod";
import { ImageMimeType, StorageProvider, VideoMimeType } from "../constants/enums.js";
import { PAGINATION } from "../constants/limits.js";

const storageProviderSchema = z.nativeEnum(StorageProvider);

/** A non-destructive overlay (text / box / blur) rendered over playback. */
export const overlaySchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(["text", "rect", "blur"]),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  text: z.string().max(200).optional(),
  color: z.string().max(32).optional(),
});

/**
 * Metadata-create payload. Two modes:
 *  - classic: posted AFTER the bytes landed in storage (`storageFileId` set);
 *  - instant link: posted AT RECORD-STOP without `storageFileId` — the row is
 *    created with `uploadStatus: UPLOADING` so a share link exists immediately,
 *    and the client calls POST /recordings/:id/finalize once the upload lands.
 * The server already knows the owner from the JWT.
 */
export const createRecordingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  duration: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  mimeType: z.nativeEnum(VideoMimeType),
  storageProvider: storageProviderSchema,
  storageFileId: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
});
export type CreateRecordingInput = z.infer<typeof createRecordingSchema>;

/** Completes an instant-link upload: attach the landed bytes to the pending row. */
export const finalizeRecordingSchema = z.object({
  storageFileId: z.string().min(1),
  /** Final byte size (may differ from the estimate sent at create time). */
  size: z.number().int().positive().optional(),
  /** Storage key of the poster/preview image (uploaded to Recio storage). */
  thumbnailKey: z.string().max(500).optional(),
});
export type FinalizeRecordingInput = z.infer<typeof finalizeRecordingSchema>;

export const createScreenshotSchema = z.object({
  title: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  mimeType: z.nativeEnum(ImageMimeType),
  storageProvider: storageProviderSchema,
  storageFileId: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
});
export type CreateScreenshotInput = z.infer<typeof createScreenshotSchema>;

/** PATCH payload for renaming / changing visibility. All fields optional. */
export const updateMediaSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    isPublic: z.boolean().optional(),
    // Non-destructive trim (seconds, recordings only). `null` clears that bound.
    trimStartSec: z.number().min(0).nullable().optional(),
    trimEndSec: z.number().min(0).nullable().optional(),
    // Non-destructive overlays (recordings only). `null` clears all overlays.
    overlays: z.array(overlaySchema).max(50).nullable().optional(),
    // Move into a team workspace's shared library; `null` moves back to personal.
    workspaceId: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const mediaFilter = ["ALL", "RECORDINGS", "SCREENSHOTS", "DRIVE", "FLOWCAP"] as const;
export const mediaSort = ["NEWEST", "OLDEST", "NAME", "SIZE"] as const;

/** Query params for the dashboard list endpoints (cursor pagination + filter/sort/search). */
export const listMediaQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  filter: z.enum(mediaFilter).default("ALL"),
  sort: z.enum(mediaSort).default("NEWEST"),
  search: z.string().trim().max(200).optional(),
  /** When set, list a workspace's shared library instead of the caller's personal media. */
  workspaceId: z.string().optional(),
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
