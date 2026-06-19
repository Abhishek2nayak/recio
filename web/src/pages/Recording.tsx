/** Recording overlay — the signature screen. A live capture HUD (countdown →
 *  glowing frame → webcam bubble → control dock/rail) floats over the app being
 *  captured (WorkCanvas). Full-screen, no chrome. */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  IconBtn,
  Waveform,
  WebcamBubble,
  WorkCanvas,
  ReticleMark,
  fmtClock,
} from "../components/recio/index.js";
import { Icons } from "../components/recio/icons.js";
import type { CaptureSettings } from "./Launcher.js";

export function Recording() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = (location.state as CaptureSettings | null) ?? { src: "combo", mic: true, cam: true, hd: true };

  const [controls, setControls] = useState<"dock" | "rail">("dock");
  const [count, setCount] = useState(3);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mic, setMic] = useState(settings.mic);
  const [cam, setCam] = useState(settings.cam);
  const showCam = cam && settings.src !== "screen";
  const canCam = settings.src !== "screen";
  const isRail = controls === "rail";

  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(() => setCount((c) => c - 1), 750);
    return () => clearTimeout(id);
  }, [count]);

  useEffect(() => {
    if (count > 0 || paused) return;
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [count, paused]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") navigate("/dashboard");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  function stop() {
    navigate("/dashboard");
  }
  function discard() {
    navigate("/dashboard");
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "var(--ink)" }}>
      <WorkCanvas />

      {/* countdown */}
      {count > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "oklch(0.16 0.01 262 / 0.55)",
            backdropFilter: "blur(3px)",
            zIndex: 40,
          }}
        >
          <div
            key={count}
            style={{
              position: "relative",
              width: 168,
              height: 168,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "r-fade var(--t2) var(--ease) both",
            }}
          >
            <div style={{ position: "absolute", inset: 0, color: "var(--accent)" }}>
              <ReticleMark size={168} sw={1.3} dot={false} color="currentColor" />
            </div>
            <span style={{ fontSize: 78, fontWeight: 800, color: "white", letterSpacing: "-0.04em" }}>
              {count}
            </span>
          </div>
        </div>
      )}

      {/* live capture frame */}
      {count <= 0 && (
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: "var(--r-lg)",
            pointerEvents: "none",
            zIndex: 20,
            boxShadow:
              "0 0 0 2px var(--live), 0 0 0 8px color-mix(in oklch, var(--live) 18%, transparent), 0 0 60px color-mix(in oklch, var(--live) 12%, transparent) inset",
            animation: paused ? "none" : "r-fade var(--t2) both",
          }}
        >
          <CornerBrackets />
        </div>
      )}

      {/* webcam bubble */}
      {showCam && count <= 0 && (
        <div
          style={{
            position: "absolute",
            left: 26,
            bottom: isRail ? 26 : 104,
            zIndex: 30,
            animation: "r-fade-up var(--t3) var(--ease) both",
            cursor: "grab",
          }}
        >
          <WebcamBubble size={138} hue={255} ring live={!paused} label="you" />
          <div
            className="mono"
            style={{
              position: "absolute",
              top: -26,
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: 10,
              color: "var(--hud-ink-2)",
              background: "var(--hud)",
              padding: "3px 8px",
              borderRadius: 6,
              opacity: 0.9,
            }}
          >
            drag to reposition
          </div>
        </div>
      )}

      {/* layout toggle */}
      {count <= 0 && (
        <button
          onClick={() => setControls((c) => (c === "dock" ? "rail" : "dock"))}
          title="Toggle control layout"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            zIndex: 36,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 32,
            padding: "0 12px",
            borderRadius: "var(--r-pill)",
            border: "1px solid var(--hud-line)",
            background: "color-mix(in oklch, var(--hud) 86%, transparent)",
            backdropFilter: "blur(20px)",
            color: "var(--hud-ink-2)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {isRail ? "Rail" : "Dock"}
        </button>
      )}

      {/* controls */}
      {count <= 0 &&
        (isRail ? (
          <RecRail {...{ t, paused, setPaused, mic, setMic, cam, setCam, onStop: stop, onDiscard: discard, canCam }} />
        ) : (
          <RecDock {...{ t, paused, setPaused, mic, setMic, cam, setCam, onStop: stop, onDiscard: discard, canCam }} />
        ))}
    </div>
  );
}

function CornerBrackets() {
  const corners: { pos: React.CSSProperties; transform?: string }[] = [
    { pos: { top: -1, left: -1 } },
    { pos: { top: -1, right: -1 }, transform: "scaleX(-1)" },
    { pos: { bottom: -1, left: -1 }, transform: "scaleY(-1)" },
    { pos: { bottom: -1, right: -1 }, transform: "scale(-1)" },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <svg
          key={i}
          width="30"
          height="30"
          viewBox="0 0 30 30"
          fill="none"
          stroke="var(--live)"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ position: "absolute", ...c.pos, transform: c.transform }}
        >
          <path d="M0 22 V0 H22" />
        </svg>
      ))}
    </>
  );
}

function LiveDot({ paused }: { paused: boolean }) {
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: 99,
        background: paused ? "var(--hud-ink-2)" : "var(--live)",
        animation: paused ? "none" : "r-live-blink 1.4s steps(1) infinite",
        boxShadow: paused ? "none" : "0 0 10px var(--live)",
      }}
    />
  );
}

type DockProps = {
  t: number;
  paused: boolean;
  setPaused: (f: (p: boolean) => boolean) => void;
  mic: boolean;
  setMic: (f: (m: boolean) => boolean) => void;
  cam: boolean;
  setCam: (f: (c: boolean) => boolean) => void;
  onStop: () => void;
  onDiscard: () => void;
  canCam: boolean;
};

function RecDock({ t, paused, setPaused, mic, setMic, cam, setCam, onStop, onDiscard, canCam }: DockProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 22,
        transform: "translateX(-50%)",
        zIndex: 35,
        animation: "r-fade-up var(--t3) var(--ease) both",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 8,
          borderRadius: "var(--r-pill)",
          background: "color-mix(in oklch, var(--hud) 86%, transparent)",
          backdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid var(--hud-line)",
          boxShadow: "var(--e-hud)",
        }}
      >
        <button
          onClick={onStop}
          title="Stop & save"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            height: 44,
            padding: "0 16px 0 14px",
            borderRadius: "var(--r-pill)",
            border: "none",
            cursor: "pointer",
            background: "var(--live)",
            color: "oklch(0.2 0.02 262)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <Icons.Stop size={16} />
          Stop
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", color: "var(--hud-ink)" }}>
          <LiveDot paused={paused} />
          <span className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.02em", minWidth: 52 }}>
            {fmtClock(t)}
          </span>
        </div>
        <span style={{ width: 1, height: 26, background: "var(--hud-line)" }} />
        <div style={{ width: 92, display: "flex", justifyContent: "center" }}>
          {mic ? (
            <Waveform bars={13} height={22} active={!paused} color="var(--hud-ink)" width={2.3} />
          ) : (
            <Icons.MicOff size={18} style={{ color: "var(--hud-ink-2)" }} />
          )}
        </div>
        <span style={{ width: 1, height: 26, background: "var(--hud-line)" }} />
        <IconBtn icon={paused ? Icons.Play : Icons.Pause} tone="hud" size={44} onClick={() => setPaused((p) => !p)} title={paused ? "Resume" : "Pause"} />
        <IconBtn icon={mic ? Icons.Mic : Icons.MicOff} tone="hud" size={44} active={mic} onClick={() => setMic((m) => !m)} title="Mic" />
        {canCam && <IconBtn icon={Icons.Cam} tone="hud" size={44} active={cam} onClick={() => setCam((c) => !c)} title="Camera" />}
        <IconBtn icon={Icons.Pen} tone="hud" size={44} title="Draw on screen" />
        <IconBtn icon={Icons.Trash} tone="hud" size={44} title="Discard" onClick={onDiscard} />
      </div>
    </div>
  );
}

function RecRail({ t, paused, setPaused, mic, setMic, cam, setCam, onStop, onDiscard, canCam }: DockProps) {
  return (
    <div
      style={{
        position: "absolute",
        right: 22,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 35,
        animation: "r-fade var(--t3) var(--ease) both",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: 10,
          borderRadius: "var(--r-xl)",
          background: "color-mix(in oklch, var(--hud) 88%, transparent)",
          backdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid var(--hud-line)",
          boxShadow: "var(--e-hud)",
          width: 70,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 0 8px" }}>
          <LiveDot paused={paused} />
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--hud-ink)" }}>
            {fmtClock(t)}
          </span>
        </div>
        <button
          onClick={onStop}
          title="Stop & save"
          style={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "var(--live)",
            color: "oklch(0.2 0.02 262)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icons.Stop size={20} />
        </button>
        <span style={{ height: 1, width: 36, background: "var(--hud-line)" }} />
        <IconBtn icon={paused ? Icons.Play : Icons.Pause} tone="hud" size={46} onClick={() => setPaused((p) => !p)} />
        <IconBtn icon={mic ? Icons.Mic : Icons.MicOff} tone="hud" size={46} active={mic} onClick={() => setMic((m) => !m)} />
        {canCam && <IconBtn icon={Icons.Cam} tone="hud" size={46} active={cam} onClick={() => setCam((c) => !c)} />}
        <IconBtn icon={Icons.Pen} tone="hud" size={46} />
        <IconBtn icon={Icons.Trash} tone="hud" size={46} onClick={onDiscard} />
      </div>
    </div>
  );
}
