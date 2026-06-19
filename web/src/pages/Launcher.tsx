/** Launcher — pre-record setup. Choose a source, toggle mic/cam/quality, then
 *  start the capture (3-second countdown). Full-screen, no app chrome. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Kbd,
  Logo,
  RButton,
  Tag,
  Toggle,
  Waveform,
  type IconComponent,
} from "../components/recio/index.js";
import { Icons } from "../components/recio/icons.js";

export type SourceId = "screen" | "combo" | "cam" | "shot";
export type CaptureSettings = { src: SourceId; mic: boolean; cam: boolean; hd: boolean };

const SOURCES: { id: SourceId; label: string; sub: string; icon: IconComponent }[] = [
  { id: "screen", label: "Screen", sub: "Full display or a window", icon: Icons.Screen },
  { id: "combo", label: "Screen + Cam", sub: "Walk through with your face", icon: Icons.Combo },
  { id: "cam", label: "Camera", sub: "Just you, talking", icon: Icons.Cam },
  { id: "shot", label: "Screenshot", sub: "Capture & annotate", icon: Icons.Shot },
];

/** Update when the extension ships to the Web Store. */
const EXTENSION_URL = "https://chromewebstore.google.com/";

export function Launcher() {
  const navigate = useNavigate();
  const [src, setSrc] = useState<SourceId>("combo");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [hd, setHd] = useState(true);
  const [extPrompt, setExtPrompt] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") navigate("/dashboard");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  function start() {
    // Screen / camera capture is the extension's job (it has the picker, camera
    // bubble, toolbar, and background-upload safety). The web app records
    // whiteboards natively — offer both paths.
    setExtPrompt(true);
  }

  const rows: [string, boolean, (v: boolean) => void, IconComponent, string][] = [
    ["Microphone", mic, setMic, Icons.Mic, "Built-in · system default"],
    ["Camera", cam, setCam, Icons.Cam, "FaceTime HD"],
    ["4K source quality", hd, setHd, Icons.Bolt, "Sharper text & detail"],
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(130% 120% at 50% -10%, var(--surface) 0%, var(--paper) 55%, var(--surface-2) 100%)",
      }}
    >
      <div style={{ width: 460, animation: "r-fade-up var(--t3) var(--ease) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <Logo size={26} />
          <Tag style={{ marginLeft: "auto" }}>⌥⇧R</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em" }}>
          What are you capturing?
        </h1>
        <p style={{ margin: "0 0 22px", color: "var(--ink-3)", fontSize: 15, lineHeight: 1.5 }}>
          Frame the knowledge — Vyooom handles the rest.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {SOURCES.map((s) => {
            const on = src === s.id;
            const Ico = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSrc(s.id)}
                style={{
                  textAlign: "left",
                  padding: 15,
                  borderRadius: "var(--r-lg)",
                  cursor: "pointer",
                  border: "1.5px solid",
                  borderColor: on ? "var(--accent)" : "var(--line)",
                  background: on ? "var(--accent-soft)" : "var(--surface)",
                  boxShadow: on ? "0 0 0 3px var(--accent-ring)" : "var(--e1)",
                  transition: "all var(--t2) var(--ease)",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? "var(--accent)" : "var(--surface-2)",
                    color: on ? "var(--accent-on)" : "var(--ink-2)",
                    marginBottom: 11,
                  }}
                >
                  <Ico size={20} />
                </span>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.35 }}>{s.sub}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            padding: 6,
            boxShadow: "var(--e1)",
            marginBottom: 18,
          }}
        >
          {rows.map(([lbl, val, set, Ico, sub], i) => (
            <div
              key={lbl}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 12px",
                borderTop: i ? "1px solid var(--line)" : "none",
              }}
            >
              <span style={{ color: val ? "var(--ink)" : "var(--ink-4)" }}>
                <Ico size={19} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{lbl}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                  {sub}
                </div>
              </div>
              {val && i < 2 && <Waveform bars={9} height={16} active color="var(--accent)" width={2} />}
              <Toggle on={val} onChange={set} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {src === "shot" ? (
            <RButton variant="primary" size="lg" full icon={Icons.Shot} onClick={() => setExtPrompt(true)}>
              Capture screenshot
            </RButton>
          ) : (
            <RButton variant="primary" size="lg" full icon={Icons.Reticle} onClick={start}>
              Start capture
            </RButton>
          )}
          <RButton variant="outline" size="lg" icon={Icons.Gear} title="Settings" />
        </div>
        <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--ink-4)" }}>
          Starts a <b style={{ color: "var(--ink-3)" }}>3-second</b> countdown · press <Kbd>Esc</Kbd> anytime to
          cancel
        </p>
      </div>

      {extPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,12,16,.5)",
            backdropFilter: "blur(5px)",
            padding: 24,
          }}
          onClick={() => setExtPrompt(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440,
              maxWidth: "100%",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--e3)",
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Screen capture lives in the extension
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55 }}>
              The Vyooom extension records any screen, window, or tab — with the camera bubble, floating
              controls, and crash-safe background upload. Install it once, then record from the toolbar.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href={EXTENSION_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <RButton variant="primary" size="lg" full icon={Icons.Reticle}>
                  Get the Chrome extension
                </RButton>
              </a>
              <RButton variant="outline" size="lg" full icon={Icons.Pen} onClick={() => navigate("/whiteboard")}>
                Record a whiteboard instead (no extension)
              </RButton>
              <button
                onClick={() => setExtPrompt(false)}
                style={{ marginTop: 2, border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, color: "var(--ink-4)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
