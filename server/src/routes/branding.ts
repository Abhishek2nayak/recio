/**
 * Pro custom-branding for the owner's public share pages.
 *
 *   GET   /branding    read your branding            [auth]
 *   PATCH /branding    update it                     [auth, customBranding entitlement]
 *
 * Reading is open (free users see empty defaults + an upgrade nudge in the UI);
 * writing is gated, and the share route only *applies* branding while the owner's
 * plan still includes it (so a downgrade quietly reverts to Recio branding).
 */
import { Router } from "express";
import { ok, updateBrandingSchema, type BrandingDTO, type UpdateBrandingInput } from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlement.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";

const BRAND_SELECT = { brandName: true, brandLogoUrl: true, ctaLabel: true, ctaUrl: true } as const;

export const brandingRouter: Router = Router();
brandingRouter.use(requireAuth);

brandingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: getUserId(req) }, select: BRAND_SELECT });
    if (!u) throw HttpError.unauthenticated();
    res.json(ok(u satisfies BrandingDTO));
  }),
);

brandingRouter.patch(
  "/",
  requireEntitlement("customBranding"),
  validate(updateBrandingSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as UpdateBrandingInput;
    const u = await prisma.user.update({
      where: { id: getUserId(req) },
      data: {
        ...(input.brandName !== undefined ? { brandName: input.brandName } : {}),
        ...(input.brandLogoUrl !== undefined ? { brandLogoUrl: input.brandLogoUrl } : {}),
        ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
        ...(input.ctaUrl !== undefined ? { ctaUrl: input.ctaUrl } : {}),
      },
      select: BRAND_SELECT,
    });
    res.json(ok(u satisfies BrandingDTO));
  }),
);
