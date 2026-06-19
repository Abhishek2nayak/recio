/**
 * Non-destructive overlay layer — renders text labels, boxes, and blur regions over
 * the player. In `editable` mode overlays can be dragged/resized and selected; in
 * playback mode only those whose [startSec, endSec] contains the current time show.
 * Positions are fractions (0..1) of the frame, so they scale with the player.
 */
import { useRef, type CSSProperties } from "react";
import type { Overlay } from "@flowcap/shared";

let _id = 0;
export function newOverlay(type: Overlay["type"], time: number, dur: number): Overlay {
  _id += 1;
  const base = { id: `ov_${Date.now()}_${_id}`, startSec: Math.max(0, time), endSec: Math.min(dur || time + 5, time + 5) };
  if (type === "text") return { ...base, type, x: 0.32, y: 0.18, w: 0.36, h: 0.1, text: "Label", color: "#38C6DD" };
  if (type === "blur") return { ...base, type, x: 0.36, y: 0.4, w: 0.28, h: 0.18 };
  return { ...base, type: "rect", x: 0.34, y: 0.36, w: 0.32, h: 0.24, color: "#38C6DD" };
}

export function OverlayLayer({
  overlays,
  time,
  editable = false,
  selectedId,
  onSelect,
  onChange,
}: {
  overlays: Overlay[];
  time: number;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (next: Overlay[]) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function update(id: string, patch: Partial<Overlay>) {
    onChange?.(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function drag(o: Overlay, mode: "move" | "resize") {
    return (e: React.PointerEvent) => {
      if (!editable) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect?.(o.id);
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const o0 = { ...o };
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / rect.width;
        const dy = (ev.clientY - startY) / rect.height;
        if (mode === "move") {
          update(o.id, {
            x: Math.min(1 - o0.w, Math.max(0, o0.x + dx)),
            y: Math.min(1 - o0.h, Math.max(0, o0.y + dy)),
          });
        } else {
          update(o.id, {
            w: Math.min(1 - o0.x, Math.max(0.05, o0.w + dx)),
            h: Math.min(1 - o0.y, Math.max(0.04, o0.h + dy)),
          });
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
      {overlays.map((o) => {
        const inWindow = time >= o.startSec && time <= o.endSec;
        if (!editable && !inWindow) return null;
        const selected = editable && selectedId === o.id;
        const box: CSSProperties = {
          position: "absolute",
          left: `${o.x * 100}%`,
          top: `${o.y * 100}%`,
          width: `${o.w * 100}%`,
          height: `${o.h * 100}%`,
          opacity: editable && !inWindow ? 0.35 : 1,
          cursor: editable ? "grab" : "default",
          pointerEvents: editable ? "auto" : "none",
          boxSizing: "border-box",
        };

        return (
          <div key={o.id} style={box} onPointerDown={drag(o, "move")}>
            {o.type === "blur" && (
              <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", background: "rgba(120,120,140,.18)", borderRadius: 6 }} />
            )}
            {o.type === "rect" && (
              <div style={{ position: "absolute", inset: 0, border: `3px solid ${o.color || "#38C6DD"}`, borderRadius: 6, boxShadow: "0 0 0 1px rgba(0,0,0,.25)" }} />
            )}
            {o.type === "text" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: o.color || "#38C6DD",
                  color: "#06303a",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: "clamp(11px, 3.2cqw, 22px)",
                  padding: "0 10px",
                  textAlign: "center",
                  overflow: "hidden",
                  containerType: "inline-size",
                }}
              >
                {o.text || "Label"}
              </div>
            )}
            {selected && (
              <>
                <div style={{ position: "absolute", inset: -2, border: "2px solid white", borderRadius: 8, boxShadow: "0 0 0 2px var(--accent)" }} />
                <div
                  onPointerDown={drag(o, "resize")}
                  style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, borderRadius: 4, background: "white", border: "2px solid var(--accent)", cursor: "nwse-resize" }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
