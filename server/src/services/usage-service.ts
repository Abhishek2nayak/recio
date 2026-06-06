/**
 * Monthly usage metering for the playback proxy — our one real bandwidth cost.
 * Bytes streamed through `media.ts` are counted per owner per calendar month; a
 * per-plan fair-use cap (entitlements.monthlyStreamGb) protects margins and makes the
 * "unlimited free" promise safe.
 */
import { prisma } from "../lib/prisma.js";
import { resolveEntitlements } from "../lib/entitlements.js";

const GB = 1024 * 1024 * 1024;

function currentPeriodStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Best-effort: add streamed bytes to the owner's monthly meter. */
export async function addProxyBytes(userId: string, bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const periodStart = currentPeriodStart();
  const amount = BigInt(Math.round(bytes));
  await prisma.usageCounter.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    create: { userId, periodStart, proxyBytes: amount },
    update: { proxyBytes: { increment: amount } },
  });
}

/** Add transcription minutes to the owner's monthly AI meter; returns the new total. */
export async function addAiMinutes(userId: string, minutes: number): Promise<number> {
  const periodStart = currentPeriodStart();
  const row = await prisma.usageCounter.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    create: { userId, periodStart, aiMinutes: minutes },
    update: { aiMinutes: { increment: minutes } },
  });
  return row.aiMinutes;
}

/** Transcription minutes used this period. */
export async function getAiMinutes(userId: string): Promise<number> {
  const row = await prisma.usageCounter.findUnique({
    where: { userId_periodStart: { userId, periodStart: currentPeriodStart() } },
  });
  return row?.aiMinutes ?? 0;
}

export interface StreamUsage {
  /** Bytes streamed this period. */
  used: number;
  /** Cap in bytes, or null for unlimited. */
  cap: number | null;
  periodStart: string;
}

export async function getStreamUsage(userId: string): Promise<StreamUsage> {
  const periodStart = currentPeriodStart();
  const [user, counter] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    prisma.usageCounter.findUnique({ where: { userId_periodStart: { userId, periodStart } } }),
  ]);
  const capGb = user ? resolveEntitlements(user.plan).monthlyStreamGb : 0;
  return {
    used: Number(counter?.proxyBytes ?? 0n),
    cap: capGb == null ? null : capGb * GB,
    periodStart: periodStart.toISOString(),
  };
}

/** Whether the owner has hit their monthly streaming cap. */
export async function isOverStreamCap(userId: string): Promise<boolean> {
  const { used, cap } = await getStreamUsage(userId);
  return cap != null && used >= cap;
}
