import { z } from "zod";
import { ResourceType } from "../constants/enums.js";
import { REACTION_EMOJIS } from "../constants/reactions.js";

/** Leave a reaction (public — anyone viewing a shared item can react). */
export const reactSchema = z.object({
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().min(1),
  emoji: z.enum(REACTION_EMOJIS),
});
export type ReactInput = z.infer<typeof reactSchema>;
