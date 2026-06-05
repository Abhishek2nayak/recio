import { z } from "zod";
import { ResourceType } from "../constants/enums.js";

/** Post a comment. Anyone viewing a shared item can comment (auth is optional —
 *  authenticated users post under their name; guests provide one). */
export const createCommentSchema = z.object({
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
  /** Optional video position (seconds) the comment is anchored to. */
  timestampSec: z.number().int().nonnegative().optional(),
  /** Display name for guests (ignored when authenticated). */
  authorName: z.string().trim().min(1).max(80).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface CommentDTO {
  id: string;
  authorName: string;
  body: string;
  timestampSec: number | null;
  createdAt: string;
}
