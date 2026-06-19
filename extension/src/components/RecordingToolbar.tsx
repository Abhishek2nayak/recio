/**
 * Floating control rail shown while recording — the Vyooom HUD: near-black glass
 * pill, blinking live dot, mono timer, a live-green Stop, then pause/resume,
 * restart, discard. Used in the studio; the on-page content-script bar mirrors
 * this design in vanilla DOM.
 */
import type { CSSProperties } from "react";
import { formatDuration } from "@flowcap/shared";

export function RecordingToolbar({
  state,
  elapsedMs,
  onStop,
  onPause,
  onResume,
  onRestart,
  onCancel,
}: {
  state: "recording" | "paused";
  elapsedMs: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart?: () => void;
  onCancel?: () => void;
}) {
  const recording = state === "recording";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 10,
        width: 68,
        borderRadius: "var(--r-xl)",
        background: "color-mix(in oklch, var(--hud) 88%, transparent)",
        backdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid var(--hud-line)",
        boxShadow: "var(--e-hud)",
      }}
    >
      {/* live dot + timer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0 6px" }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            background: recording ? "var(--live)" : "var(--hud-ink-2)",
            boxShadow: recording ? "0 0 10px var(--live)" : "none",
            animation: recording ? "r-live-blink 1.4s steps(1) infinite" : "none",
          }}
        />
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--hud-ink)" }}>
          {formatDuration(elapsedMs / 1000)}
        </span>
      </div>

      {/* Stop */}
      <button
        onClick={onStop}
        title="Stop & save"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "var(--live)",
          color: "oklch(0.2 0.02 262)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform var(--t1, 120ms)",
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: 4, background: "currentColor" }} />
      </button>

      <span style={{ height: 1, width: 34, background: "var(--hud-line)" }} />

      {/* Pause / Resume */}
      <Control title={recording ? "Pause" : "Resume"} onClick={recording ? onPause : onResume}>
        {recording ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5v14l12-7z" />
          </svg>
        )}
      </Control>

      {onRestart && (
        <Control title="Restart" onClick={onRestart}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </Control>
      )}

      {onCancel && (
        <Control title="Discard" onClick={onCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </Control>
      )}
    </div>
  );
}

function Control({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  const style: CSSProperties = {
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--r-sm)",
    border: "none",
    background: "rgba(255,255,255,.07)",
    color: "var(--hud-ink-2)",
    cursor: "pointer",
    transition: "background 120ms, color 120ms",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      style={style}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.12)";
        e.currentTarget.style.color = "var(--hud-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.07)";
        e.currentTarget.style.color = "var(--hud-ink-2)";
      }}
    >
      {children}
    </button>
  );
}
