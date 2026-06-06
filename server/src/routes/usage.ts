/** GET /usage — the caller's monthly playback-streaming usage vs their plan cap. */
import { Router } from "express";
import { ok } from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { getStreamUsage } from "../services/usage-service.js";

export const usageRouter: Router = Router();
usageRouter.use(requireAuth);

usageRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(ok(await getStreamUsage(getUserId(req))));
  }),
);
