/**
 * Reactions — public emoji reactions on a recording/screenshot.
 *
 *   GET  /reactions/:resourceId   aggregate counts (public)
 *   POST /reactions               leave a reaction (public)
 *
 * No auth: anyone viewing a shared item can react. Counts are aggregated per
 * (resourceId, emoji); the apiLimiter guards against spam.
 */
import { Router } from "express";
import { ok, reactSchema, type ReactInput, type ReactionCounts, type TimedReaction } from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { param } from "../lib/params.js";

export const reactionsRouter: Router = Router();

async function countsFor(resourceId: string): Promise<ReactionCounts> {
  const rows = await prisma.reaction.findMany({
    where: { resourceId },
    select: { emoji: true, count: true },
  });
  const map: ReactionCounts = {};
  for (const r of rows) map[r.emoji] = r.count;
  return map;
}

/** Cap the timeline payload — plenty for rendering bursts, bounded for virality. */
const TIMELINE_LIMIT = 500;

async function timelineFor(resourceId: string): Promise<TimedReaction[]> {
  return prisma.reactionEvent.findMany({
    where: { resourceId },
    orderBy: { createdAt: "desc" },
    take: TIMELINE_LIMIT,
    select: { emoji: true, timestampSec: true },
  });
}

reactionsRouter.get(
  "/:resourceId",
  asyncHandler(async (req, res) => {
    const resourceId = param(req, "resourceId");
    const [counts, timeline] = await Promise.all([countsFor(resourceId), timelineFor(resourceId)]);
    res.json(ok({ counts, timeline }));
  }),
);

reactionsRouter.post(
  "/",
  validate(reactSchema),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId, emoji, timestampSec } = req.body as ReactInput;
    await prisma.reaction.upsert({
      where: { resourceId_emoji: { resourceId, emoji } },
      create: { resourceType, resourceId, emoji, count: 1 },
      update: { count: { increment: 1 } },
    });
    // Anchored to a moment in the video → also log the timeline event (bursts).
    if (timestampSec !== undefined) {
      await prisma.reactionEvent.create({ data: { resourceType, resourceId, emoji, timestampSec } });
    }
    const [counts, timeline] = await Promise.all([countsFor(resourceId), timelineFor(resourceId)]);
    res.json(ok({ counts, timeline }));
  }),
);
