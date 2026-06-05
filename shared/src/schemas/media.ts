import { z } from "zod";
import { ImageMimeType, StorageProvider, VideoMimeType } from "../constants/enums.js";
import { PAGINATION } from "../constants/limits.js";

const storageProviderSchema = z.nativeEnum(StorageProvider);

/**
 * Metadata-create payload, posted AFTER the bytes have landed in storage (Drive or
 * Recio S3). The server already knows the owner from the JWT.
 */
export const createRecordingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  duration: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  mimeType: z.nativeEnum(VideoMimeType),
  storageProvider: storageProviderSchema,
  storageFileId: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
});
export type CreateRecordingInput = z.infer<typeof createRecordingSchema>;

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
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
