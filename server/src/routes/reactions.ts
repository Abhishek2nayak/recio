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
import { ok, reactSchema, type ReactInput, type ReactionCounts } from "@flowcap/shared";
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

reactionsRouter.get(
  "/:resourceId",
  asyncHandler(async (req, res) => {
    res.json(ok({ counts: await countsFor(param(req, "resourceId")) }));
  }),
);

reactionsRouter.post(
  "/",
  validate(reactSchema),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId, emoji } = req.body as ReactInput;
    await prisma.reaction.upsert({
      where: { resourceId_emoji: { resourceId, emoji } },
      create: { resourceType, resourceId, emoji, count: 1 },
      update: { count: { increment: 1 } },
    });
    res.json(ok({ counts: await countsFor(resourceId) }));
  }),
);
