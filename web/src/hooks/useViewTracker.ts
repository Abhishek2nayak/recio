/**
 * Logs a view session for a public share and reports watch-through from a <video>.
 * One session per page-load (sessionId); a persistent viewerId in localStorage
 * distinguishes unique viewers. Progress is throttled to ~10% milestones and flushed
 * when the tab is hidden/closed.
 */
import { useEffect, useRef, type RefObject } from "react";
import type { ResourceType } from "@flowcap/shared";
import { api } from "../lib/api.js";

function getViewerId(): string {
  let id = localStorage.getItem("recio_viewer");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("recio_viewer", id);
  }
  return id;
}

export function useViewTracker(
  resourceType: ResourceType,
  resourceId: string,
  videoRef?: RefObject<HTMLVideoElement | null>,
): void {
  const sessionRef = useRef(crypto.randomUUID());
  const maxPct = useRef(0);
  const sentPct = useRef(0);

  useEffect(() => {
    const session = sessionRef.current;
    const viewerId = getViewerId();
    const send = (pct: number) =>
      void api
        .recordView({ resourceType, resourceId, viewerId, sessionId: session, watchedPct: Math.round(pct) })
        .catch(() => {});

    send(0); // count the view immediately

    const video = videoRef?.current ?? null;
    const onTime = () => {
      if (!video || !video.duration || !isFinite(video.duration)) return;
      const pct = Math.min(100, (video.currentTime / video.duration) * 100);
      if (pct > maxPct.current) maxPct.current = pct;
      if (maxPct.current - sentPct.current >= 10) {
        sentPct.current = maxPct.current;
        send(maxPct.current);
      }
    };
    const flush = () => {
      if (maxPct.current > sentPct.current) {
        sentPct.current = maxPct.current;
        send(maxPct.current);
      }
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();

    video?.addEventListener("timeupdate", onTime);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      flush();
      video?.removeEventListener("timeupdate", onTime);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [resourceType, resourceId, videoRef]);
}
