/**
 * Reusable entitlement gates that need a DB lookup (plan lives on the user row).
 * Boolean checks against the shared matrix stay in `lib/entitlements.ts`; this is
 * the "load the user, then decide" layer routes/services share.
 */
import { ErrorCode } from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { canFeature } from "../lib/entitlements.js";

/**
 * Vyooom Cloud (FLOWCAP) is a Premium destination: the pitch is bring-your-own
 * storage, and hosting on our servers is the paid convenience tier. Connecting
 * Google Drive or Dropbox is always free.
 */
export async function requireHostedStorage(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (user && canFeature(user.plan, "hostedStorage")) return;
  throw new HttpError(
    ErrorCode.UPGRADE_REQUIRED,
    "Vyooom Cloud storage is part of Premium. Connect your own Google Drive or Dropbox (free) in Settings, or upgrade to save on Vyooom Cloud.",
  );
}
