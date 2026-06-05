/**
 * Engagement analytics.
 *
 *   POST /analytics/view      record/extend a view session            [public]
 *   GET  /analytics/:id       aggregates for an owned media item       [auth, owner]
 *
 * Views are logged from the PUBLIC share page only (not the owner's detail page), so
 * the owner's own viewing doesn't inflate counts — matching how Loom reports reach.
 * Deep stats (avg watch-through, drop-off) are gated by the `fullAnalytics`
 * entitlement; free owners see total + unique and an upgrade nudge.
 */
import { Router } from "express";
import { can, ok, recordViewSchema, type AnalyticsDTO, type RecordViewInput } from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { param } from "../lib/params.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { findMediaByResource, findOwnedMediaById } from "../services/media-service.js";
import { getAnalytics, recordView } from "../services/analytics-service.js";

export const analyticsRouter: Router = Router();

analyticsRouter.post(
  "/view",
  validate(recordViewSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as RecordViewInput;
    // Light guard against bogus ids: only log for live media that exists.
    const media = await findMediaByResource(input.resourceType, input.resourceId);
    if (media) await recordView(input);
    res.json(ok({ recorded: Boolean(media) }));
  }),
);

analyticsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const media = await findOwnedMediaById(userId, param(req, "id"));
    if (!media) throw HttpError.notFound("Media not found.");

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    const includePro = user ? can(user.plan, "fullAnalytics") : false;

    const data: AnalyticsDTO = await getAnalytics(media.id, includePro);
    res.json(ok(data));
  }),
);
