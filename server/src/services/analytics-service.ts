/**
 * Engagement analytics. One `ViewEvent` per page-load (keyed by sessionId, keeping
 * the MAX watchedPct), aggregated on read into total/unique views + (Pro) average
 * watch-through and a drop-off histogram.
 */
import type { AnalyticsDTO, RecordViewInput } from "@flowcap/shared";
import { prisma } from "../lib/prisma.js";

/** Upsert a view session and grow its max progress. */
export async function recordView(input: RecordViewInput): Promise<void> {
  await prisma.viewEvent.upsert({
    where: { sessionId: input.sessionId },
    create: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      viewerId: input.viewerId,
      sessionId: input.sessionId,
      watchedPct: input.watchedPct,
    },
    update: {},
  });
  if (input.watchedPct > 0) {
    // Only ever move watchedPct forward.
    await prisma.viewEvent.updateMany({
      where: { sessionId: input.sessionId, watchedPct: { lt: input.watchedPct } },
      data: { watchedPct: input.watchedPct },
    });
  }
}

export async function getAnalytics(resourceId: string, includePro: boolean): Promise<AnalyticsDTO> {
  const events = await prisma.viewEvent.findMany({
    where: { resourceId },
    select: { viewerId: true, watchedPct: true },
  });

  const views = events.length;
  const uniqueViewers = new Set(events.map((e) => e.viewerId)).size;

  let pro: AnalyticsDTO["pro"] = null;
  if (includePro) {
    const avgWatchedPct = views
      ? Math.round(events.reduce((sum, e) => sum + e.watchedPct, 0) / views)
      : 0;
    const dropOff = new Array(10).fill(0) as number[];
    for (const e of events) {
      const idx = Math.min(9, Math.floor(e.watchedPct / 10));
      dropOff[idx] = (dropOff[idx] ?? 0) + 1;
    }
    pro = { avgWatchedPct, dropOff };
  }

  return { views, uniqueViewers, pro };
}
