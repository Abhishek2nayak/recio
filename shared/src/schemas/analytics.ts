import { z } from "zod";
import { ResourceType } from "../constants/enums.js";

/**
 * A single view "ping" from a player. Sent on load (watchedPct 0) and as progress
 * advances; the server upserts by `sessionId` and keeps the MAX watchedPct, so one
 * page-load = one view session whose completion grows over time.
 */
export const recordViewSchema = z.object({
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().min(1),
  /** Persisted in the viewer's localStorage — distinguishes unique viewers. */
  viewerId: z.string().min(1).max(64),
  /** Random per page-load — the upsert key. */
  sessionId: z.string().min(1).max(64),
  /** Max progress reached, 0..100 (always 0 for screenshots). */
  watchedPct: z.number().int().min(0).max(100).default(0),
});
export type RecordViewInput = z.infer<typeof recordViewSchema>;
