import { z } from "zod";
import { ResourceType } from "../constants/enums.js";
import { REACTION_EMOJIS } from "../constants/reactions.js";

/** Leave a reaction (public — anyone viewing a shared item can react). */
export const reactSchema = z.object({
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().min(1),
  emoji: z.enum(REACTION_EMOJIS),
  /** Video position (seconds) the reaction is anchored to — shown on the player
   *  timeline (Loom-style bursts). Omitted for page-level reactions/screenshots. */
  timestampSec: z.number().min(0).max(60 * 60 * 12).optional(),
});
export type ReactInput = z.infer<typeof reactSchema>;

/** One timeline reaction event (for rendering bursts along the seek bar). */
export interface TimedReaction {
  emoji: string;
  timestampSec: number;
}
