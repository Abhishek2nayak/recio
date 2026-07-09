// recio-app.jsx — app shell, flow state machine, flow navigator, tweaks
const { useState: useA, useEffect: useEA } = React;
const IA = window.Icons;
const { Logo: LogoA, Button: BtnA, Tag: TagA } = window;
const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSlider, TweakRow } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "pulse",
  "controls": "dock",
  "dashLayout": "grid",
  "radius": 1
}/*EDITMODE-END*/;

const THEMES = [
  { id: "pulse", name: "Pulse", sub: "electric green", swatch: "oklch(0.77 0.175 150)" },
  { id: "tide", name: "Tide", sub: "electric cyan", swatch: "oklch(0.72 0.13 232)" },
  { id: "ink", name: "Ink", sub: "monochrome", swatch: "oklch(0.30 0.012 262)" },
];

const FLOW = [
  { id: "launcher", label: "Launch", icon: IA.Reticle },
  { id: "recording", label: "Record", icon: IA.Screen },
  { id: "review", label: "Review", icon: IA.Trim },
  { id: "share", label: "Share", icon: IA.Share },
  { id: "dashboard", label: "Library", icon: IA.Grid },
];

function FlowNav({ screen, go }) {
  return (
    <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 2147483000, display: "flex", alignItems: "center", gap: 3,
      padding: 5, borderRadius: "var(--r-pill)", background: "color-mix(in oklch, var(--surface) 78%, transparent)", backdropFilter: "blur(16px) saturate(160%)",
      border: "1px solid var(--line)", boxShadow: "var(--e2)" }}>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-4)", padding: "0 8px 0 6px" }}>flow</span>
      {FLOW.map((s, i) => {
        const on = screen === s.id;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <I_chev />}
            <button onClick={() => go(s.id)} title={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: on ? "0 13px" : "0 9px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
              background: on ? "var(--ink)" : "transparent", color: on ? "white" : "var(--ink-3)", fontSize: 12.5, fontWeight: 600, transition: "all var(--t1)" }}>
              <s.icon size={14} />{on && <span>{s.label}</span>}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
function I_chev() { return <span style={{ color: "var(--ink-4)", display: "inline-flex", opacity: 0.5 }}><IA.ChevR size={12} /></span>; }

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useA("dashboard");
  const [settings, setSettings] = useA({ src: "combo", mic: true, cam: true });
  const [duration, setDuration] = useA(84);

  // apply theme + radius tokens
  useEA(() => { document.documentElement.dataset.theme = t.theme; }, [t.theme]);
  useEA(() => {
    const r = t.radius, root = document.documentElement.style;
    root.setProperty("--r-sm", `${7 * r}px`); root.setProperty("--r", `${11 * r}px`);
    root.setProperty("--r-lg", `${16 * r}px`); root.setProperty("--r-xl", `${22 * r}px`); root.setProperty("--r-2xl", `${30 * r}px`);
  }, [t.radius]);

  const go = (s) => setScreen(s);
  const start = (cfg) => { setSettings(cfg); setScreen("recording"); };
  const stop = (secs) => { setDuration(Math.max(20, secs || 84)); setScreen("review"); };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div key={screen} style={{ position: "absolute", inset: 0, animation: "r-fade var(--t2) var(--ease) both" }}>
        {screen === "dashboard" && <window.DashboardScreen layout={t.dashLayout} onNew={() => go("launcher")} onOpen={() => go("share")} />}
        {screen === "launcher" && <window.LauncherScreen onStart={start} onShot={() => go("review")} />}
        {screen === "recording" && <window.RecordingScreen controls={t.controls} settings={settings} onStop={stop} />}
        {screen === "review" && <window.ReviewScreen duration={duration} onShare={() => go("share")} onDashboard={() => go("dashboard")} />}
        {screen === "share" && <window.ShareScreen duration={duration} onDashboard={() => go("dashboard")} />}
      </div>

      <FlowNav screen={screen} go={go} />

      <TweaksPanel>
        <TweakSection label="Visual direction" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {THEMES.map(th => {
            const on = t.theme === th.id;
            return (
              <button key={th.id} onClick={() => setTweak("theme", th.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10, cursor: "pointer",
                border: "1px solid", borderColor: on ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.1)", background: on ? "rgba(255,255,255,.6)" : "transparent", textAlign: "left" }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: th.swatch, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#29261b" }}>{th.name}</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "rgba(41,38,27,.55)" }}>{th.sub}</span>
                </span>
                {on && <span style={{ color: "#29261b" }}><IA.Check size={15} /></span>}
              </button>
            );
          })}
        </div>

        <TweakSection label="Recording controls" />
        <TweakRadio label="Layout" value={t.controls} options={["dock", "rail"]} onChange={(v) => { setTweak("controls", v); setScreen("recording"); }} />

        <TweakSection label="Dashboard" />
        <TweakRadio label="View" value={t.dashLayout} options={["grid", "stream"]} onChange={(v) => { setTweak("dashLayout", v); setScreen("dashboard"); }} />

        <TweakSection label="Shape" />
        <TweakSlider label="Corner radius" value={t.radius} min={0} max={1.8} step={0.1} onChange={(v) => setTweak("radius", v)} />

        <TweakSection label="Jump to screen" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {FLOW.map(s => (
            <button key={s.id} onClick={() => setScreen(s.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
              border: "1px solid", borderColor: screen === s.id ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.1)", background: screen === s.id ? "rgba(255,255,255,.6)" : "transparent", color: "#29261b", fontSize: 12, fontWeight: 600 }}>
              <s.icon size={14} />{s.label}
            </button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
