/**
 * Share records. The canonical public link id is the media's own `shareToken`; the
 * Share row attaches permission (view/comment) + optional expiry to that token.
 * Keeping Share.token aligned with media.shareToken means one id resolves the link,
 * the metadata, and ownership.
 */
import type { Share } from "@prisma/client";
import { ResourceType, SharePermission } from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export function buildShareUrl(token: string): string {
  return `${env.WEB_ORIGIN}/s/${token}`;
}

export function upsertShare(params: {
  userId: string;
  token: string;
  resourceType: ResourceType;
  resourceId: string;
  permission: SharePermission;
  expiresAt: Date | null;
}): Promise<Share> {
  const { userId, token, resourceType, resourceId, permission, expiresAt } = params;
  return prisma.share.upsert({
    where: { token },
    update: { permission, expiresAt },
    create: { token, resourceType, resourceId, createdByUserId: userId, permission, expiresAt },
  });
}

export function getShareByToken(token: string): Promise<Share | null> {
  return prisma.share.findUnique({ where: { token } });
}

export async function deleteShare(token: string): Promise<void> {
  await prisma.share.deleteMany({ where: { token } });
}

/** A Share is "live" when it exists without expiry, or its expiry is in the future. */
export function isShareLive(share: Share | null): boolean {
  if (!share) return true; // no explicit Share row → governed solely by media.isPublic
  return !share.expiresAt || share.expiresAt.getTime() > Date.now();
}
