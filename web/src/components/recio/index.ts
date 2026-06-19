/** Vyooom design-system module — icons, primitives, player, and shared helpers. */
export * from "./icons.js";
export * from "./primitives.js";
export * from "./Player.js";
export * from "./WorkCanvas.js";
export * from "./Overlays.js";

/** mm:ss with zero-padded minutes (recording HUD / timecodes). */
export function fmtClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.max(0, Math.floor(t % 60));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
