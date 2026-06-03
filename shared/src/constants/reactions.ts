/** The fixed set of reactions a viewer can leave on a recording/screenshot. */
export const REACTION_EMOJIS = ["❤️", "👍", "🔥", "👏", "🙌", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Aggregate counts keyed by emoji, e.g. `{ "🔥": 3, "👍": 1 }`. */
export type ReactionCounts = Record<string, number>;
