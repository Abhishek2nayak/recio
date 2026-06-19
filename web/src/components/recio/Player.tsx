/**
 * Player surface — the dark gradient/video player reused by Review & Share. Ported
 * from the handoff `Player`. When `src` is provided it renders a real <video>;
 * otherwise it shows the simulated gradient placeholder with a scrub bar.
 */
import { forwardRef, type CSSProperties } from "react";
import { Icons } from "./icons.js";

const fmtT = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.max(0, Math.round(t % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
};

export type PlayerProps = {
  progress: number;
  playing: boolean;
  onToggle: () => void;
  /** Click/drag on the scrub bar seeks (fraction 0..1). Without it the bar is display-only. */
  onSeek?: (fraction: number) => void;
  dur?: number;
  hue?: number;
  big?: boolean;
  chapters?: string[];
  src?: string | null;
  poster?: string | null;
  /** WebVTT captions track URL (built from the transcript); adds a CC track. */
  captionsUrl?: string | null;
  sourceLabel?: string;
  showWebcam?: boolean;
  style?: CSSProperties;
};

export const Player = forwardRef<HTMLVideoElement, PlayerProps>(function Player(
  {
    progress,
    playing,
    onToggle,
    onSeek,
    dur = 84,
    hue = 235,
    big,
    chapters,
    src,
    poster,
    captionsUrl,
    sourceLabel = "screen + cam · 1512p",
    showWebcam = true,
    style,
  },
  ref,
) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16 / 10",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        background: "var(--hud)",
        boxShadow: "var(--e3)",
        border: "1px solid var(--line)",
        ...style,
      }}
    >
      {src ? (
        <video
          ref={ref}
          src={src}
          poster={poster ?? undefined}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "var(--hud)" }}
        >
          {captionsUrl && <track kind="captions" srcLang="en" label="Captions" src={captionsUrl} />}
        </video>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(120% 120% at 32% 20%, oklch(0.34 0.04 ${hue}) 0%, oklch(0.21 0.02 ${hue}) 58%, oklch(0.16 0.012 262) 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.45,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 1px, transparent 1px 12px)",
            }}
          />
          <span
            className="mono"
            style={{
              position: "absolute",
              left: 14,
              top: 12,
              fontSize: 11,
              color: "rgba(255,255,255,.5)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {sourceLabel}
          </span>
          {showWebcam && (
            <div
              style={{
                position: "absolute",
                left: 16,
                bottom: 58,
                width: big ? 92 : 70,
                height: big ? 92 : 70,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2.5px solid rgba(255,255,255,.85)",
                boxShadow: "var(--e2)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(120% 100% at 35% 25%, oklch(0.55 0.09 255), oklch(0.3 0.04 255))",
                }}
              />
            </div>
          )}
        </>
      )}

      {/* play */}
      <button
        onClick={onToggle}
        style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          width: big ? 76 : 60,
          height: big ? 76 : 60,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "rgba(255,255,255,.92)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--e3)",
          backdropFilter: "blur(4px)",
        }}
      >
        {playing ? (
          <Icons.Pause size={big ? 28 : 22} />
        ) : (
          <Icons.Play size={big ? 28 : 22} style={{ marginLeft: 3 }} />
        )}
      </button>

      {/* scrub bar */}
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
        {chapters && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {chapters.map((c, i) => (
              <span
                key={i}
                className="mono"
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,.62)",
                  background: "rgba(0,0,0,.3)",
                  padding: "2px 7px",
                  borderRadius: 5,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "white", fontWeight: 600 }}>
            {fmtT(dur * progress)}
          </span>
          <div
            onPointerDown={
              onSeek
                ? (e) => {
                    const el = e.currentTarget;
                    el.setPointerCapture(e.pointerId);
                    const seek = (clientX: number) => {
                      const r = el.getBoundingClientRect();
                      onSeek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
                    };
                    seek(e.clientX);
                    const move = (ev: PointerEvent) => seek(ev.clientX);
                    const up = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }
                : undefined
            }
            style={{
              position: "relative",
              flex: 1,
              height: 5,
              borderRadius: 99,
              background: "rgba(255,255,255,.22)",
              cursor: onSeek ? "pointer" : "default",
              touchAction: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progress * 100}%`,
                background: "var(--accent)",
                borderRadius: 99,
              }}
            />
            <span
              style={{
                position: "absolute",
                left: `${progress * 100}%`,
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 13,
                height: 13,
                borderRadius: 99,
                background: "white",
                boxShadow: "var(--e2)",
              }}
            />
          </div>
          <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>
            {fmtT(dur)}
          </span>
        </div>
      </div>
    </div>
  );
});

export { fmtT };
