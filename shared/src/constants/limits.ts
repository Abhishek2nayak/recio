/**
 * Plan limits, upload tuning, and pagination defaults.
 *
 * Plan limits are SCAFFOLDED in the MVP — the server computes and exposes them but
 * does not hard-block on them yet (see the architecture doc, "plan-based limits").
 */
import { Plan } from "./enums.js";

/** Per-plan caps. `null` means unlimited. */
export const PLAN_LIMITS: Record<Plan, { maxRecordings: number | null; maxScreenshots: number | null }> = {
  FREE: { maxRecordings: 25, maxScreenshots: 100 },
  PRO: { maxRecordings: null, maxScreenshots: null },
};

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

/** Default folder name created in the user's Drive for FlowCap uploads. */
export const DRIVE_ROOT_FOLDER_NAME = "FlowCap";
