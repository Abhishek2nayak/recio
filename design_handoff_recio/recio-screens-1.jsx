// recio-screens-1.jsx — WorkCanvas (the screen being captured), Launcher, Recording overlay
const { useState: useS1, useEffect: useE1, useRef: useR1 } = React;
const I1 = window.Icons;
const { Logo: Logo1, Button: Btn1, IconBtn: IB1, Tag: Tag1, Waveform: Wave1, WebcamBubble: Bubble1, Avatar: Av1, AvatarStack: AvS1, Kbd: Kbd1, Toggle: Tg1 } = window;

/* =========================================================================
   WorkCanvas — a believable generic productivity screen behind the recording.
   (Not a real brand. A product spec board being walked through.)
   ========================================================================= */
function WorkCanvas() {
  const cols = [
    { t: "Discovery", n: 3, items: [["Audit current onboarding", 210], ["User interviews · round 2", 150]] },
    { t: "In progress", n: 4, items: [["Activation funnel redesign", 40], ["Empty-state illustrations", 300], ["Mobile capture flow", 255]] },
    { t: "Review", n: 2, items: [["Pricing page copy", 12]] },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--surface-2)", overflow: "hidden", userSelect: "none" }}>
      {/* fake app topbar */}
      <div style={{ height: 52, borderBottom: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", padding: "0 20px", gap: 14 }}>
        <div style={{ display: "flex", gap: 7 }}>{["oklch(0.8 0.08 25)", "oklch(0.85 0.09 85)", "oklch(0.82 0.09 150)"].map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />)}</div>
        <div style={{ marginLeft: 8, fontWeight: 700, fontSize: 14, color: "var(--ink-2)" }}>Northwind · Product</div>
        <div style={{ display: "flex", gap: 4, marginLeft: 18, color: "var(--ink-3)", fontSize: 13, fontWeight: 600 }}>
          <span style={{ padding: "5px 10px", borderRadius: 7, background: "var(--surface-2)", color: "var(--ink)" }}>Board</span>
          <span style={{ padding: "5px 10px" }}>Timeline</span>
          <span style={{ padding: "5px 10px" }}>Docs</span>
        </div>
        <div style={{ marginLeft: "auto" }}><AvS1 people={[{ name: "AK", hue: 210 }, { name: "TM", hue: 150 }, { name: "JD", hue: 40 }]} size={26} /></div>
      </div>
      {/* board */}
      <div style={{ display: "flex", gap: 18, padding: 22, height: "calc(100% - 52px)" }}>
        {cols.map((c, ci) => (
          <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
              {c.t}<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>{c.n}</span>
            </div>
            {c.items.map(([title, hue], ii) => (
              <div key={ii} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, boxShadow: "var(--e1)" }}>
                <div style={{ width: 34, height: 6, borderRadius: 99, background: `oklch(0.78 0.1 ${hue})`, marginBottom: 11 }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 12, lineHeight: 1.35 }}>{title}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Av1 name={["AK", "TM", "JD", "RS"][(ci + ii) % 4]} hue={hue} size={22} />
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>RC-{120 + ci * 7 + ii}</span>
                </div>
              </div>
            ))}
            <div style={{ height: 36, borderRadius: 10, border: "1.5px dashed var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 18 }}>+</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   LauncherScreen — pre-record setup
   ========================================================================= */
const SOURCES = [
  { id: "screen", label: "Screen", sub: "Full display or a window", icon: I1.Screen },
  { id: "combo", label: "Screen + Cam", sub: "Walk through with your face", icon: I1.Combo },
  { id: "cam", label: "Camera", sub: "Just you, talking", icon: I1.Cam },
  { id: "shot", label: "Screenshot", sub: "Capture & annotate", icon: I1.Shot },
];
function LauncherScreen({ onStart, onShot }) {
  const [src, setSrc] = useS1("combo");
  const [mic, setMic] = useS1(true);
  const [cam, setCam] = useS1(true);
  const [hd, setHd] = useS1(true);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      background: "radial-gradient(130% 120% at 50% -10%, var(--surface) 0%, var(--paper) 55%, var(--surface-2) 100%)" }}>
      <div style={{ width: 460, animation: "r-fade-up var(--t3) var(--ease) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <Logo1 size={26} />
          <Tag1 style={{ marginLeft: "auto" }}>⌥⇧R</Tag1>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em" }}>What are you capturing?</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ink-3)", fontSize: 15, lineHeight: 1.5 }}>Frame the knowledge — Recio handles the rest.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {SOURCES.map(s => {
            const on = src === s.id;
            return (
              <button key={s.id} onClick={() => setSrc(s.id)} style={{ textAlign: "left", padding: 15, borderRadius: "var(--r-lg)", cursor: "pointer",
                border: "1.5px solid", borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent-soft)" : "var(--surface)",
                boxShadow: on ? "0 0 0 3px var(--accent-ring)" : "var(--e1)", transition: "all var(--t2) var(--ease)", position: "relative" }}>
                <span style={{ display: "inline-flex", width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center",
                  background: on ? "var(--accent)" : "var(--surface-2)", color: on ? "var(--accent-ink)" : "var(--ink-2)", marginBottom: 11 }}><s.icon size={20} /></span>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.35 }}>{s.sub}</div>
              </button>
            );
          })}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 6, boxShadow: "var(--e1)", marginBottom: 18 }}>
          {[["Microphone", mic, setMic, I1.Mic, "Built-in · MacBook Pro"], ["Camera", cam, setCam, I1.Cam, "FaceTime HD"], ["4K source quality", hd, setHd, I1.Bolt, "Sharper text & detail"]].map(([lbl, val, set, Ico, sub], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ color: val ? "var(--ink)" : "var(--ink-4)" }}><Ico size={19} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{lbl}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{sub}</div>
              </div>
              {val && i < 2 && <Wave1 bars={9} height={16} active color="var(--accent)" width={2} />}
              <Tg1 on={val} onChange={set} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {src === "shot"
            ? <Btn1 variant="primary" size="lg" full icon={I1.Shot} onClick={onShot}>Capture screenshot</Btn1>
            : <Btn1 variant="primary" size="lg" full icon={I1.Reticle} onClick={() => onStart({ src, mic, cam })}>Start capture</Btn1>}
          <Btn1 variant="outline" size="lg" icon={I1.Gear} aria-label="settings" />
        </div>
        <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--ink-4)" }}>
          Starts a <b style={{ color: "var(--ink-3)" }}>3-second</b> countdown · press <Kbd1>Esc</Kbd1> anytime to cancel
        </p>
      </div>
    </div>
  );
}

/* =========================================================================
   RecordingScreen — the signature overlay
   ========================================================================= */
function fmt(t) { const m = Math.floor(t / 60), s = t % 60; return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }

function RecordingScreen({ controls = "dock", onStop, settings }) {
  const [count, setCount] = useS1(3);
  const [t, setT] = useS1(0);
  const [paused, setPaused] = useS1(false);
  const [mic, setMic] = useS1(settings?.mic ?? true);
  const [cam, setCam] = useS1(settings?.cam ?? true);
  const showCam = cam && settings?.src !== "screen";

  useE1(() => { if (count <= 0) return; const id = setTimeout(() => setCount(c => c - 1), 750); return () => clearTimeout(id); }, [count]);
  useE1(() => { if (count > 0 || paused) return; const id = setInterval(() => setT(x => x + 1), 1000); return () => clearInterval(id); }, [count, paused]);

  const isRail = controls === "rail";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--ink)" }}>
      <WorkCanvas />

      {/* countdown */}
      {count > 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(0.16 0.01 262 / 0.55)", backdropFilter: "blur(3px)", zIndex: 40 }}>
          <div key={count} style={{ position: "relative", width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center", animation: "r-fade var(--t2) var(--ease) both" }}>
            <div style={{ position: "absolute", inset: 0, color: "var(--accent)" }}><window.ReticleMark size={168} sw={1.3} dot={false} color="currentColor" /></div>
            <span style={{ fontSize: 78, fontWeight: 800, color: "white", letterSpacing: "-0.04em" }}>{count}</span>
          </div>
        </div>
      )}

      {/* recording frame (reticle, the live capture border) */}
      {count <= 0 && (
        <div style={{ position: "absolute", inset: 10, borderRadius: "var(--r-lg)", pointerEvents: "none", zIndex: 20,
          boxShadow: `0 0 0 2px var(--live), 0 0 0 8px color-mix(in oklch, var(--live) 18%, transparent), 0 0 60px color-mix(in oklch, var(--live) 12%, transparent) inset`,
          animation: paused ? "none" : "r-fade var(--t2) both" }}>
          {[["top:-1px;left:-1px", "M0 22 V0 H22"], ["top:-1px;right:-1px;transform:scaleX(-1)", "M0 22 V0 H22"], ["bottom:-1px;left:-1px;transform:scaleY(-1)", "M0 22 V0 H22"], ["bottom:-1px;right:-1px;transform:scale(-1)", "M0 22 V0 H22"]].map((c, i) => (
            <svg key={i} width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="var(--live)" strokeWidth="3" strokeLinecap="round"
              style={{ position: "absolute", ...Object.fromEntries(c[0].split(";").map(s => s.split(":"))) }}><path d={c[1]} /></svg>
          ))}
        </div>
      )}

      {/* webcam bubble */}
      {showCam && count <= 0 && (
        <div style={{ position: "absolute", left: 26, bottom: isRail ? 26 : 104, zIndex: 30, animation: "r-fade-up var(--t3) var(--ease) both", cursor: "grab" }}>
          <Bubble1 size={138} hue={255} ring live={!paused} label="you" />
          <div className="mono" style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 10, color: "var(--hud-ink-2)", background: "var(--hud)", padding: "3px 8px", borderRadius: 6, opacity: 0.9 }}>drag to reposition</div>
        </div>
      )}

      {/* CONTROLS */}
      {isRail
        ? <RecRail t={t} paused={paused} setPaused={setPaused} mic={mic} setMic={setMic} cam={cam} setCam={setCam} onStop={() => onStop(t)} canCam={settings?.src !== "screen"} />
        : <RecDock t={t} paused={paused} setPaused={setPaused} mic={mic} setMic={setMic} cam={cam} setCam={setCam} onStop={() => onStop(t)} canCam={settings?.src !== "screen"} />}
    </div>
  );
}

function LiveDot({ paused }) {
  return <span style={{ width: 9, height: 9, borderRadius: 99, background: paused ? "var(--hud-ink-2)" : "var(--live)", animation: paused ? "none" : "r-live-blink 1.4s steps(1) infinite", boxShadow: paused ? "none" : "0 0 10px var(--live)" }} />;
}

function RecDock({ t, paused, setPaused, mic, setMic, cam, setCam, onStop, canCam }) {
  return (
    <div style={{ position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 35, animation: "r-fade-up var(--t3) var(--ease) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 8, borderRadius: "var(--r-pill)", background: "color-mix(in oklch, var(--hud) 86%, transparent)",
        backdropFilter: "blur(20px) saturate(160%)", border: "1px solid var(--hud-line)", boxShadow: "var(--e-hud)" }}>
        <button onClick={onStop} title="Stop & save" style={{ display: "flex", alignItems: "center", gap: 9, height: 44, padding: "0 16px 0 14px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
          background: "var(--live)", color: "oklch(0.2 0.02 262)", fontWeight: 700, fontSize: 14 }}>
          <I1.Stop size={16} />Stop
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", color: "var(--hud-ink)" }}>
          <LiveDot paused={paused} />
          <span className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.02em", minWidth: 52 }}>{fmt(t)}</span>
        </div>
        <span style={{ width: 1, height: 26, background: "var(--hud-line)" }} />
        <div style={{ width: 92, display: "flex", justifyContent: "center" }}>
          {mic ? <Wave1 bars={13} height={22} active={!paused} color="var(--hud-ink)" width={2.3} /> : <I1.MicOff size={18} style={{ color: "var(--hud-ink-2)" }} />}
        </div>
        <span style={{ width: 1, height: 26, background: "var(--hud-line)" }} />
        <IB1 icon={paused ? I1.Play : I1.Pause} tone="hud" size={44} onClick={() => setPaused(p => !p)} title={paused ? "Resume" : "Pause"} />
        <IB1 icon={mic ? I1.Mic : I1.MicOff} tone="hud" size={44} active={mic} onClick={() => setMic(m => !m)} title="Mic" />
        {canCam && <IB1 icon={cam ? I1.Cam : I1.Cam} tone="hud" size={44} active={cam} onClick={() => setCam(c => !c)} title="Camera" />}
        <IB1 icon={I1.Pen} tone="hud" size={44} title="Draw on screen" />
        <IB1 icon={I1.Trash} tone="hud" size={44} title="Discard" />
      </div>
    </div>
  );
}

function RecRail({ t, paused, setPaused, mic, setMic, cam, setCam, onStop, canCam }) {
  return (
    <div style={{ position: "absolute", right: 22, top: "50%", transform: "translateY(-50%)", zIndex: 35, animation: "r-fade var(--t3) var(--ease) both" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 10, borderRadius: "var(--r-xl)",
        background: "color-mix(in oklch, var(--hud) 88%, transparent)", backdropFilter: "blur(20px) saturate(160%)", border: "1px solid var(--hud-line)", boxShadow: "var(--e-hud)", width: 70 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 0 8px" }}>
          <LiveDot paused={paused} />
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--hud-ink)" }}>{fmt(t)}</span>
        </div>
        <button onClick={onStop} title="Stop & save" style={{ width: 50, height: 50, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--live)", color: "oklch(0.2 0.02 262)", display: "flex", alignItems: "center", justifyContent: "center" }}><I1.Stop size={20} /></button>
        <span style={{ height: 1, width: 36, background: "var(--hud-line)" }} />
        <IB1 icon={paused ? I1.Play : I1.Pause} tone="hud" size={46} onClick={() => setPaused(p => !p)} />
        <IB1 icon={mic ? I1.Mic : I1.MicOff} tone="hud" size={46} active={mic} onClick={() => setMic(m => !m)} />
        {canCam && <IB1 icon={I1.Cam} tone="hud" size={46} active={cam} onClick={() => setCam(c => !c)} />}
        <IB1 icon={I1.Pen} tone="hud" size={46} />
        <IB1 icon={I1.Trash} tone="hud" size={46} />
      </div>
    </div>
  );
}

window.Screens1 = { WorkCanvas, LauncherScreen, RecordingScreen };
Object.assign(window, { WorkCanvas, LauncherScreen, RecordingScreen });
