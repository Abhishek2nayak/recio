/**
 * Sharing routes. The media's `shareToken` IS the public link id.
 *
 *   POST   /share                    create/refresh a link (marks media public)  [auth]
 *   GET    /share/:token             resolve a link → playback info              [public]
 *   PATCH  /share/:token/permissions "Anyone with link" ↔ "Private"             [auth, owner]
 *   DELETE /share/:token             turn the link off + drop the share record   [auth, owner]
 *
 * Private (Drive) ACL changes happen server-side via `setMediaVisibility`.
 */
import { Router } from "express";
import {
  ErrorCode,
  LinkVisibility,
  ResourceType,
  SharePermission,
  createShareSchema,
  ok,
  updateSharePermissionSchema,
  type CreateShareInput,
  type PublicShareViewDTO,
  type ShareDTO,
  type UpdateSharePermissionInput,
} from "@flowcap/shared";
import type { Recording, Share } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { param } from "../lib/params.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  findByShareToken,
  findMediaByResource,
  incrementViewCount,
  setMediaVisibility,
} from "../services/media-service.js";
import { getPlaybackUrl } from "../services/storage-service.js";
import { createSignedDownloadUrl } from "../services/supabase-storage.js";
import { canFeature } from "../lib/entitlements.js";
import {
  buildShareUrl,
  deleteShare,
  getShareByToken,
  isShareLive,
  upsertShare,
} from "../services/share-service.js";

export const shareRouter: Router = Router();

function toShareDTO(share: Share): ShareDTO {
  return {
    id: share.id,
    resourceType: share.resourceType,
    resourceId: share.resourceId,
    token: share.token,
    permission: share.permission,
    expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    createdAt: share.createdAt.toISOString(),
  };
}

// ── Create / refresh a link (owner) ──
shareRouter.post(
  "/",
  requireAuth,
  validate(createShareSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { resourceType, resourceId, permission, expiresAt } = req.body as CreateShareInput;

    const media = await findMediaByResource(resourceType, resourceId);
    if (!media || media.userId !== userId) throw HttpError.notFound("Media not found.");

    // Marking a link live makes the media public (toggles the Drive ACL for Drive media).
    await setMediaVisibility(userId, resourceType, resourceId, true);

    const share = await upsertShare({
      userId,
      token: media.shareToken,
      resourceType,
      resourceId,
      permission: permission ?? SharePermission.VIEW,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    res.status(201).json(
      ok({ share: toShareDTO(share), shareUrl: buildShareUrl(media.shareToken) }),
    );
  }),
);

// ── Resolve a link (public, no auth) ──
shareRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const result = await findByShareToken(param(req, "token"));
    if (!result) throw HttpError.notFound("This link doesn't exist.");

    const { media, type } = result;
    const share = await getShareByToken(param(req, "token"));

    // Link is off if the media is private, or the Share row has expired.
    if (!media.isPublic || !isShareLive(share)) {
      throw new HttpError(ErrorCode.RESOURCE_GONE, "This link is turned off.");
    }

    // Instant-link flow: the link exists but the bytes are still uploading. Serve
    // the page in "processing" mode (the client polls); don't count these as views.
    const processing = !media.storageFileId;
    if (!processing) await incrementViewCount(type, media.id);
    const playbackUrl = processing
      ? ""
      : await getPlaybackUrl(media.userId, media.storageProvider, media.storageFileId, media.id);
    const owner = await prisma.user.findUnique({
      where: { id: media.userId },
      select: { name: true, plan: true, brandName: true, brandLogoUrl: true, ctaLabel: true, ctaUrl: true },
    });
    // Only apply branding while the owner's plan still includes it.
    const branding =
      owner && canFeature(owner.plan, "customBranding")
        ? {
            brandName: owner.brandName,
            brandLogoUrl: owner.brandLogoUrl,
            ctaLabel: owner.ctaLabel,
            ctaUrl: owner.ctaUrl,
          }
        : null;

    const view: PublicShareViewDTO = {
      resourceType: type,
      resourceId: media.id,
      title: media.title,
      mimeType: media.mimeType as PublicShareViewDTO["mimeType"],
      playbackUrl,
      processing,
      shareUrl: buildShareUrl(media.shareToken),
      duration: type === ResourceType.RECORDING ? (media as Recording).duration : null,
      trimStartSec: type === ResourceType.RECORDING ? (media as Recording).trimStartSec : null,
      trimEndSec: type === ResourceType.RECORDING ? (media as Recording).trimEndSec : null,
      cuts:
        type === ResourceType.RECORDING
          ? ((media as Recording).cuts as unknown as PublicShareViewDTO["cuts"]) ?? null
          : null,
      overlays:
        type === ResourceType.RECORDING
          ? ((media as Recording).overlays as unknown as PublicShareViewDTO["overlays"]) ?? null
          : null,
      viewCount: media.viewCount + (processing ? 0 : 1),
      ownerName: owner?.name ?? null,
      branding,
      createdAt: media.createdAt.toISOString(),
      permission: share?.permission ?? SharePermission.VIEW,
    };
    res.json(ok(view));
  }),
);

// ── Captions for a public share (no auth) ──
// Word-level transcript timestamps so the viewer can build a captions track. Only
// served while the link is live, and only for recordings with a READY transcript.
shareRouter.get(
  "/:token/transcript",
  asyncHandler(async (req, res) => {
    const result = await findByShareToken(param(req, "token"));
    if (!result || result.type !== ResourceType.RECORDING) throw HttpError.notFound("Not found.");
    const share = await getShareByToken(param(req, "token"));
    if (!result.media.isPublic || !isShareLive(share)) {
      throw new HttpError(ErrorCode.RESOURCE_GONE, "This link is turned off.");
    }
    const t = await prisma.transcript.findUnique({ where: { recordingId: result.media.id } });
    if (!t || t.status !== "READY") {
      res.json(ok({ words: null, text: null }));
      return;
    }
    res.json(ok({ words: (t.words as unknown as { word: string; start: number; end: number }[]) ?? null, text: t.text }));
  }),
);

// ── Poster image for a public share (no auth) ──
// Stable URL for link previews (og:image): redirects to a fresh signed download URL
// for the stored thumbnail key, or to the absolute URL if one was stored.
shareRouter.get(
  "/:token/thumb",
  asyncHandler(async (req, res) => {
    const result = await findByShareToken(param(req, "token"));
    if (!result?.media.isPublic || !result.media.thumbnailUrl) {
      throw HttpError.notFound("No thumbnail.");
    }
    const stored = result.media.thumbnailUrl;
    const url = stored.startsWith("http") ? stored : await createSignedDownloadUrl(stored);
    res.redirect(302, url);
  }),
);

// ── Flip visibility (owner) ──
shareRouter.patch(
  "/:token/permissions",
  requireAuth,
  validate(updateSharePermissionSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { visibility } = req.body as UpdateSharePermissionInput;

    const result = await findByShareToken(param(req, "token"));
    if (!result || result.media.userId !== userId) throw HttpError.notFound("Link not found.");

    const isPublic = visibility === LinkVisibility.PUBLIC;
    await setMediaVisibility(userId, result.type, result.media.id, isPublic);
    res.json(ok({ token: param(req, "token"), visibility }));
  }),
);

// ── Turn the link off + drop the share record (owner) ──
shareRouter.delete(
  "/:token",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const result = await findByShareToken(param(req, "token"));
    if (!result || result.media.userId !== userId) throw HttpError.notFound("Link not found.");

    await setMediaVisibility(userId, result.type, result.media.id, false);
    await deleteShare(param(req, "token"));
    res.json(ok({ revoked: true }));
  }),
);
