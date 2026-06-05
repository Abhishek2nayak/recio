/**
 * `requireEntitlement(cap)` — gate a route behind a plan capability.
 *
 * Reads the authenticated user's `plan` (denormalized on the User row) and checks the
 * shared capability matrix. Throws `UPGRADE_REQUIRED` (HTTP 402) if the plan lacks it,
 * which the web client intercepts to show the upsell. Must run AFTER `requireAuth`.
 *
 * This is the single server-side enforcement point — feature routes just add the
 * middleware; they never branch on `plan` themselves.
 */
import type { RequestHandler } from "express";
import { ErrorCode, can, type BooleanEntitlement } from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { getUserId } from "./auth.js";

export function requireEntitlement(capability: BooleanEntitlement): RequestHandler {
  return async (req, _res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: getUserId(req) },
        select: { plan: true },
      });
      if (!user) throw HttpError.unauthenticated();
      if (!can(user.plan, capability)) {
        throw new HttpError(
          ErrorCode.UPGRADE_REQUIRED,
          "This feature requires a paid plan. Upgrade to unlock it.",
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
