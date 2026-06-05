/**
 * Upload tuning and pagination defaults.
 *
 * Per-plan caps moved to `entitlements.ts` (the single capability matrix). Use
 * `entitlementsFor(plan).maxRecordings` etc. instead of the old `PLAN_LIMITS`.
 */

/** Upload tuning. */
export const UPLOAD = {
  /** Drive resumable + S3 multipart chunk size. 8 MiB is a safe multiple of 256 KiB (Drive's requirement). */
  CHUNK_SIZE_BYTES: 8 * 1024 * 1024,
  /** Hard ceiling on a single media file (sanity guard, not a plan limit). */
  MAX_FILE_BYTES: 5 * 1024 * 1024 * 1024,
} as const;

/** Cursor pagination defaults for list endpoints. */
export const PAGINATION = {
  DEFAULT_LIMIT: 24,
  MAX_LIMIT: 100,
} as const;

/** Default folder name created in the user's Drive for Recio uploads. */
export const DRIVE_ROOT_FOLDER_NAME = "Recio";
