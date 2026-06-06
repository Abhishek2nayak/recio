/**
 * Non-destructively skip "cut" ranges during playback (smart cleanup: filler words +
 * silences). When the playhead enters a cut, jump to its end. The file is untouched —
 * only playback is shortened. `enabled` is off while the owner edits the trim.
 */
import { useEffect, type RefObject } from "react";
import type { CutSegment } from "@flowcap/shared";

export function useSkipSegments(
  videoRef: RefObject<HTMLVideoElement | null>,
  cuts: CutSegment[] | null,
  enabled = true,
): void {
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !enabled || !cuts || cuts.length === 0) return;
    const sorted = [...cuts].sort((a, b) => a.start - b.start);

    const onTime = () => {
      const t = v.currentTime;
      for (const c of sorted) {
        if (t >= c.start && t < c.end - 0.05) {
          v.currentTime = c.end;
          break;
        }
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [videoRef, cuts, enabled]);
}
