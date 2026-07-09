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
import { z } from "zod";
import {
  ErrorCode,
  LinkVisibility,
  ResourceType,
  SharePermission,
  CAPTION_LANGUAGES,
  createShareSchema,
  ok,
  translateShareSchema,
  updateSharePermissionSchema,
  updateShareSettingsSchema,
  unlockShareSchema,
  type CreateShareInput,
  type PublicShareViewDTO,
  type ShareDTO,
  type TranslatedCaptionsDTO,
  type TranslateShareInput,
  type UpdateSharePermissionInput,
  type UpdateShareSettingsInput,
  type UnlockShareInput,
} from "@flowcap/shared";
import type { Recording, Share } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { param } from "../lib/params.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  findByShareToken,
  findMediaByResource,
  incrementViewCount,
  setMediaVisibility,
} from "../services/media-service.js";
import { getPlaybackUrl } from "../services/storage-service.js";
import { getOrCreateTranslation } from "../services/ai-service.js";
import { createSignedDownloadUrl } from "../services/supabase-storage.js";
import { canFeature } from "../lib/entitlements.js";
import {
  buildShareUrl,
  deleteShare,
  getShareByToken,
  isShareLive,
  updateShareSettings,
  upsertShare,
} from "../services/share-service.js";

type ShareResult = NonNullable<Awaited<ReturnType<typeof findByShareToken>>>;

export const shareRouter: Router = Router();

function toShareDTO(share: Share): ShareDTO {
  return {
    id: share.id,
    resourceType: share.resourceType,
    resourceId: share.resourceId,
    token: share.token,
    permission: share.permission,
    expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    hasPassword: share.passwordHash != null,
    createdAt: share.createdAt.toISOString(),
  };
}

/** Minimal view for a password-gated link: withholds playback + identifying details
 * until the viewer unlocks. */
function lockedView(result: ShareResult, share: Share | null): PublicShareViewDTO {
  const { media, type } = result;
  return {
    resourceType: type,
    resourceId: media.id,
    title: media.title,
    mimeType: media.mimeType as PublicShareViewDTO["mimeType"],
    playbackUrl: "",
    processing: false,
    shareUrl: buildShareUrl(media.shareToken),
    duration: null,
    trimStartSec: null,
    trimEndSec: null,
    cuts: null,
    overlays: null,
    viewCount: media.viewCount,
    ownerName: null,
    branding: null,
    cta: null,
    createdAt: media.createdAt.toISOString(),
    permission: share?.permission ?? SharePermission.VIEW,
    locked: true,
  };
}

/** Build the full public view (playback URL, branding, etc.) and optionally count a view. */
async function buildPublicView(result: ShareResult, share: Share | null, countView: boolean): Promise<PublicShareViewDTO> {
  const { media, type } = result;
  // Instant-link flow: link exists but bytes are still uploading → "processing" mode.
  const processing = !media.storageFileId;
  if (!processing && countView) await incrementViewCount(type, media.id);
  const playbackUrl = processing
    ? ""
    : await getPlaybackUrl(media.userId, media.storageProvider, media.storageFileId, media.id);
  const owner = await prisma.user.findUnique({
    where: { id: media.userId },
    select: { name: true, plan: true, brandName: true, brandLogoUrl: true, ctaLabel: true, ctaUrl: true },
  });
  const branding =
    owner && canFeature(owner.plan, "customBranding")
      ? { brandName: owner.brandName, brandLogoUrl: owner.brandLogoUrl, ctaLabel: owner.ctaLabel, ctaUrl: owner.ctaUrl }
      : null;
  // CTA: the recording's own button (free, per-video) wins; else the account CTA, which
  // only surfaces while the owner's plan includes branding.
  const rec = type === ResourceType.RECORDING ? (media as Recording) : null;
  const cta =
    rec?.ctaLabel && rec.ctaUrl
      ? { label: rec.ctaLabel, url: rec.ctaUrl }
      : branding?.ctaLabel && branding.ctaUrl
        ? { label: branding.ctaLabel, url: branding.ctaUrl }
        : null;
  return {
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
    cuts: type === ResourceType.RECORDING ? ((media as Recording).cuts as unknown as PublicShareViewDTO["cuts"]) ?? null : null,
    overlays:
      type === ResourceType.RECORDING ? ((media as Recording).overlays as unknown as PublicShareViewDTO["overlays"]) ?? null : null,
    viewCount: media.viewCount + (processing || !countView ? 0 : 1),
    ownerName: owner?.name ?? null,
    branding,
    cta,
    createdAt: media.createdAt.toISOString(),
    permission: share?.permission ?? SharePermission.VIEW,
    locked: false,
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

    const share = await getShareByToken(param(req, "token"));

    // Link is off if the media is private, or the Share row has expired.
    if (!result.media.isPublic || !isShareLive(share)) {
      throw new HttpError(ErrorCode.RESOURCE_GONE, "This link is turned off.");
    }

    // Password-gated → return a locked stub; the viewer must POST /unlock first.
    if (share?.passwordHash) {
      res.json(ok(lockedView(result, share)));
      return;
    }

    res.json(ok(await buildPublicView(result, share, true)));
  }),
);

// ── Unlock a password-gated link (public, no auth) ──
shareRouter.post(
  "/:token/unlock",
  validate(unlockShareSchema),
  asyncHandler(async (req, res) => {
    const result = await findByShareToken(param(req, "token"));
    if (!result) throw HttpError.notFound("This link doesn't exist.");
    const share = await getShareByToken(param(req, "token"));
    if (!result.media.isPublic || !isShareLive(share)) {
      throw new HttpError(ErrorCode.RESOURCE_GONE, "This link is turned off.");
    }
    if (share?.passwordHash) {
      const { password } = req.body as UnlockShareInput;
      const okPw = await verifyPassword(password, share.passwordHash);
      if (!okPw) throw HttpError.badRequest("Incorrect password.");
    }
    res.json(ok(await buildPublicView(result, share, true)));
  }),
);

// ── Privacy settings: passcode + expiry (owner) ──
shareRouter.patch(
  "/:token/settings",
  requireAuth,
  validate(updateShareSettingsSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const result = await findByShareToken(param(req, "token"));
    if (!result || result.media.userId !== userId) throw HttpError.notFound("Link not found.");

    const { password, expiresAt } = req.body as UpdateShareSettingsInput;
    const passwordHash = password === undefined ? undefined : password ? await hashPassword(password) : null;
    const expiry = expiresAt === undefined ? undefined : expiresAt ? new Date(expiresAt) : null;

    const share = await updateShareSettings({
      userId,
      token: result.media.shareToken,
      resourceType: result.type,
      resourceId: result.media.id,
      passwordHash,
      expiresAt: expiry,
    });
    res.json(ok({ share: toShareDTO(share) }));
  }),
);

// ── AI-translated captions for a public share (no auth) ──
shareRouter.post(
  "/:token/translate",
  validate(translateShareSchema),
  asyncHandler(async (req, res) => {
    const { lang } = req.body as TranslateShareInput;
    const language = CAPTION_LANGUAGES.find((l) => l.code === lang);
    if (!language) throw HttpError.badRequest("Unsupported language.");

    const result = await findByShareToken(param(req, "token"));
    if (!result || result.type !== ResourceType.RECORDING) throw HttpError.notFound("Not found.");
    const share = await getShareByToken(param(req, "token"));
    if (!result.media.isPublic || !isShareLive(share)) {
      throw new HttpError(ErrorCode.RESOURCE_GONE, "This link is turned off.");
    }

    const cues = await getOrCreateTranslation(result.media.id, language.code, language.label);
    const payload: TranslatedCaptionsDTO = { language: language.code, cues };
    res.json(ok(payload));
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

// ── Relay a share link to Slack / Discord via the user's incoming webhook ──
// No auth: the caller supplies their own webhook URL (kept client-side). We proxy the
// POST server-side because Slack webhooks block browser CORS, and to constrain the
// destination host (SSRF guard).
const ALLOWED_WEBHOOK_HOSTS = new Set([
  "hooks.slack.com",
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);

const notifySchema = z.object({
  provider: z.enum(["slack", "discord"]),
  webhookUrl: z.string().url(),
  title: z.string().min(1).max(300),
  url: z.string().url(),
  note: z.string().max(1000).optional(),
});

shareRouter.post(
  "/notify",
  asyncHandler(async (req, res) => {
    const body = notifySchema.parse(req.body);
    let host: string;
    try {
      host = new URL(body.webhookUrl).host;
    } catch {
      throw HttpError.badRequest("Invalid webhook URL.");
    }
    if (!ALLOWED_WEBHOOK_HOSTS.has(host)) {
      throw HttpError.badRequest("Only Slack and Discord webhook URLs are supported.");
    }

    const lead = body.note ? `${body.note}\n` : "";
    const payload =
      body.provider === "slack"
        ? { text: `${lead}🎥 *${body.title}*\n${body.url}` }
        : { content: `${lead}🎥 **${body.title}**\n${body.url}` };

    const resp = await fetch(body.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw HttpError.badRequest(`The webhook rejected the message (${resp.status}).`);
    res.json(ok({ sent: true }));
  }),
);
