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

    await incrementViewCount(type, media.id);
    const playbackUrl = await getPlaybackUrl(media.userId, media.storageProvider, media.storageFileId, media.id);
    const owner = await prisma.user.findUnique({
      where: { id: media.userId },
      select: { name: true },
    });

    const view: PublicShareViewDTO = {
      resourceType: type,
      resourceId: media.id,
      title: media.title,
      mimeType: media.mimeType as PublicShareViewDTO["mimeType"],
      playbackUrl,
      duration: type === ResourceType.RECORDING ? (media as Recording).duration : null,
      trimStartSec: type === ResourceType.RECORDING ? (media as Recording).trimStartSec : null,
      trimEndSec: type === ResourceType.RECORDING ? (media as Recording).trimEndSec : null,
      viewCount: media.viewCount + 1,
      ownerName: owner?.name ?? null,
      createdAt: media.createdAt.toISOString(),
      permission: share?.permission ?? SharePermission.VIEW,
    };
    res.json(ok(view));
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
