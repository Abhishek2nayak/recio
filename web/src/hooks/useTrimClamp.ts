/**
 * Clamp a <video>'s playback to a non-destructive trim range [startSec, endSec].
 * Starts at startSec and pauses at endSec — the file is untouched, only playback is
 * bounded. `enabled` is turned off while the owner is editing the trim so they can
 * scrub the full timeline freely.
 */
import { useEffect, type RefObject } from "react";

export function useTrimClamp(
  videoRef: RefObject<HTMLVideoElement | null>,
  startSec: number | null,
  endSec: number | null,
  enabled = true,
): void {
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !enabled || (startSec == null && endSec == null)) return;
    const start = startSec ?? 0;
    const end = endSec ?? Infinity;

    const clampStart = () => {
      if (start > 0 && v.currentTime < start) v.currentTime = start;
    };
    const onTime = () => {
      if (v.currentTime >= end) {
        v.pause();
        try {
          v.currentTime = end;
        } catch {
          /* non-seekable */
        }
      } else if (v.currentTime < start - 0.3) {
        v.currentTime = start;
      }
    };

    v.addEventListener("loadedmetadata", clampStart);
    v.addEventListener("play", clampStart);
    v.addEventListener("timeupdate", onTime);
    if (v.readyState >= 1) clampStart();
    return () => {
      v.removeEventListener("loadedmetadata", clampStart);
      v.removeEventListener("play", clampStart);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [videoRef, startSec, endSec, enabled]);
}
