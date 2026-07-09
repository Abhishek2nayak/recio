// recio-screens-2.jsx — Review, Share, Dashboard
const { useState: useS2, useEffect: useE2, useRef: useR2 } = React;
const I2 = window.Icons;
const { Logo: Logo2, Button: Btn2, IconBtn: IB2, Chip: Chip2, Tag: Tag2, Thumb: Thumb2, Avatar: Av2, AvatarStack: AvS2, Ring: Ring2, Kbd: Kbd2, Toggle: Tg2, Waveform: Wave2 } = window;

const fmtT = (t) => { const m = Math.floor(t / 60), s = t % 60; return `${m}:${String(s).padStart(2, "0")}`; };

/* =========================================================================
   Player surface — reused in Review & Share
   ========================================================================= */
function Player({ progress, playing, onToggle, dur = 84, hue = 235, big, chapters }) {
  return (
    <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--hud)", boxShadow: "var(--e3)", border: "1px solid var(--line)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 120% at 32% 20%, oklch(0.34 0.04 ${hue}) 0%, oklch(0.21 0.02 ${hue}) 58%, oklch(0.16 0.012 262) 100%)` }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.45, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 1px, transparent 1px 12px)" }} />
      <span className="mono" style={{ position: "absolute", left: 14, top: 12, fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: "0.05em", textTransform: "uppercase" }}>screen + cam · 1512p</span>
      {/* webcam inset */}
      <div style={{ position: "absolute", left: 16, bottom: 58, width: big ? 92 : 70, height: big ? 92 : 70, borderRadius: "50%", overflow: "hidden", border: "2.5px solid rgba(255,255,255,.85)", boxShadow: "var(--e2)" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 35% 25%, oklch(0.55 0.09 255), oklch(0.3 0.04 255))" }} />
      </div>
      {/* play */}
      <button onClick={onToggle} style={{ position: "absolute", inset: 0, margin: "auto", width: big ? 76 : 60, height: big ? 76 : 60, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "rgba(255,255,255,.92)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--e3)", backdropFilter: "blur(4px)" }}>
        {playing ? <I2.Pause size={big ? 28 : 22} /> : <I2.Play size={big ? 28 : 22} style={{ marginLeft: 3 }} />}
      </button>
      {/* scrub bar */}
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
        {chapters && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {chapters.map((c, i) => <span key={i} className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,.62)", background: "rgba(0,0,0,.3)", padding: "2px 7px", borderRadius: 5 }}>{c}</span>)}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "white", fontWeight: 600 }}>{fmtT(Math.round(dur * progress))}</span>
          <div style={{ position: "relative", flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.22)" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, background: "var(--accent)", borderRadius: 99 }} />
            <span style={{ position: "absolute", left: `${progress * 100}%`, top: "50%", transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: 99, background: "white", boxShadow: "var(--e2)" }} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>{fmtT(dur)}</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   ReviewScreen — trim + title + auto chapters before sharing
   ========================================================================= */
function ReviewScreen({ duration = 84, onShare, onDashboard }) {
  const [title, setTitle] = useS2("Activation funnel redesign — walkthrough");
  const [prog, setProg] = useS2(0.28);
  const [playing, setPlaying] = useS2(false);
  const [trim, setTrim] = useS2([0.04, 0.93]);
  useE2(() => { if (!playing) return; const id = setInterval(() => setProg(p => (p >= trim[1] ? trim[0] : p + 0.006)), 60); return () => clearInterval(id); }, [playing, trim]);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      {/* top bar */}
      <header style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", gap: 16, padding: "0 20px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <Logo2 size={22} />
        <span style={{ width: 1, height: 22, background: "var(--line-2)" }} />
        <Tag2 tone="accent"><I2.Bolt size={12} /> Ready in seconds</Tag2>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <Btn2 variant="ghost" size="sm" onClick={onDashboard}>Save to library</Btn2>
          <Btn2 variant="primary" size="sm" icon={I2.Share} onClick={onShare}>Share</Btn2>
        </div>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 332px", minHeight: 0 }}>
        {/* editor */}
        <div className="r-scroll" style={{ overflow: "auto", padding: "26px 28px" }}>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: "var(--sans)",
            fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 16, padding: 0 }} />
          <Player progress={prog} playing={playing} onToggle={() => setPlaying(p => !p)} dur={duration} chapters={["00:00 Intro", "00:21 The problem", "00:52 New flow"]} big />

          {/* trim timeline */}
          <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, boxShadow: "var(--e1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
              <I2.Trim size={17} style={{ color: "var(--ink-2)" }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Trim</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{fmtT(Math.round(duration * (trim[1] - trim[0])))} kept</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <Btn2 variant="soft" size="sm" icon={I2.Speed}>Remove silences</Btn2>
              </div>
            </div>
            <div style={{ position: "relative", height: 52, borderRadius: 10, background: "var(--hud)", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 2.5, padding: "0 4px" }}>
                {Array.from({ length: 64 }).map((_, i) => <span key={i} style={{ flex: 1, height: `${24 + Math.abs(Math.sin(i * 0.7)) * 22}px`, background: "rgba(255,255,255,.18)", borderRadius: 2 }} />)}
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${trim[0] * 100}%`, background: "oklch(0.16 0.01 262 / 0.7)" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${(1 - trim[1]) * 100}%`, background: "oklch(0.16 0.01 262 / 0.7)" }} />
              {[0, 1].map(idx => (
                <div key={idx} style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${trim[idx] * 100}% - 6px)`, width: 12, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 6, height: "100%", background: "var(--accent)", borderRadius: 4, boxShadow: "var(--e1)" }} />
                </div>
              ))}
              <div style={{ position: "absolute", top: -2, bottom: -2, left: `${prog * 100}%`, width: 2, background: "white", boxShadow: "0 0 8px rgba(0,0,0,.5)" }} />
            </div>
          </div>
        </div>

        {/* side panel */}
        <aside className="r-scroll" style={{ borderLeft: "1px solid var(--line)", background: "var(--surface)", overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          <Section2 icon={I2.Bolt} title="Auto summary" badge="AI">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>A 3-part walkthrough of the redesigned activation funnel: the drop-off we found, the new first-run flow, and the metrics we'll watch.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {["activation", "onboarding", "Q3-roadmap"].map(t => <Tag2 key={t}>#{t}</Tag2>)}
            </div>
          </Section2>
          <Section2 icon={I2.Comment} title="Transcript" badge="EN">
            {[["00:02", "So the core problem is people sign up but never reach the aha moment…"], ["00:24", "Here's the new three-step flow we're proposing."], ["00:55", "And these are the two metrics we'll watch weekly."]].map(([ts, tx], i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 600, flexShrink: 0, paddingTop: 1 }}>{ts}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>{tx}</span>
              </div>
            ))}
          </Section2>
        </aside>
      </div>
    </div>
  );
}

function Section2({ icon: Ico, title, badge, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <Ico size={16} style={{ color: "var(--ink-2)" }} />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
        {badge && <Tag2 tone="accent" style={{ marginLeft: "auto", height: 19, fontSize: 10 }}>{badge}</Tag2>}
      </div>
      {children}
    </div>
  );
}

/* =========================================================================
   ShareScreen — the link recipients open. Cloud-storage is front & center.
   ========================================================================= */
function ShareScreen({ onDashboard, duration = 84 }) {
  const [prog, setProg] = useS2(0);
  const [playing, setPlaying] = useS2(false);
  const [copied, setCopied] = useS2(false);
  const [access, setAccess] = useS2("link");
  useE2(() => { if (!playing) return; const id = setInterval(() => setProg(p => (p >= 1 ? 0 : p + 0.005)), 60); return () => clearInterval(id); }, [playing]);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return (
    <div className="r-scroll" style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--paper)" }}>
      <header style={{ height: 60, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", borderBottom: "1px solid var(--line)", background: "color-mix(in oklch, var(--surface) 80%, transparent)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
        <Logo2 size={22} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <Btn2 variant="ghost" size="sm" onClick={onDashboard}>Library</Btn2>
          <Av2 name="AK" hue={210} size={30} />
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 60px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 26, alignItems: "start" }}>
        <div>
          <Player progress={prog} playing={playing} onToggle={() => setPlaying(p => !p)} dur={duration} big />
          {/* title row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 18 }}>
            <Av2 name="AK" hue={210} size={42} />
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>Activation funnel redesign — walkthrough</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)" }}>
                <b style={{ color: "var(--ink-2)", fontWeight: 600 }}>Alex Kerr</b><span>·</span><span>Today, 2:14 PM</span><span>·</span>
                <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><I2.Eye size={13} /> 12</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[I2.Bolt, I2.Download, I2.More].map((Ic, i) => <IB2 key={i} icon={Ic} size={36} />)}
            </div>
          </div>
          {/* reactions */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Chip2 active icon={I2.Check}>Got it</Chip2>
            <Chip2 icon={I2.Comment}>3 comments</Chip2>
            <Chip2 icon={I2.Users}>Share with team</Chip2>
          </div>

          {/* comments */}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {[["TM", 150, "Tara Mireles", "0:24", "This new flow is so much cleaner. Can we A/B the CTA copy on step 2?"], ["JD", 40, "Jonah Diaz", "0:58", "Love it. I'll wire up the activation metric dashboard this week."]].map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 12 }}>
                <Av2 name={c[0]} hue={c[1]} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <b style={{ fontSize: 13.5 }}>{c[2]}</b>
                    <Tag2 tone="accent" style={{ height: 18, fontSize: 10 }}>{c[3]}</Tag2>
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>{c[4]}</p>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Av2 name="AK" hue={210} size={34} />
              <div style={{ flex: 1, height: 40, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface)", display: "flex", alignItems: "center", padding: "0 14px", color: "var(--ink-4)", fontSize: 13.5 }}>Add a comment at <span className="mono" style={{ margin: "0 4px", color: "var(--accent-ink)" }}>{fmtT(Math.round(duration * prog))}</span>…</div>
            </div>
          </div>
        </div>

        {/* right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* share link card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, boxShadow: "var(--e1)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Share</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 38, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface-2)", display: "flex", alignItems: "center", padding: "0 12px", gap: 8, minWidth: 0 }}>
                <I2.Link size={15} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>recio.to/a/4f9c2</span>
              </div>
              <Btn2 variant={copied ? "primary" : "dark"} size="md" icon={copied ? I2.Check : I2.Copy} onClick={copy}>{copied ? "Copied" : "Copy"}</Btn2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[["link", I2.Globe, "Anyone with the link", "Can view & comment"], ["team", I2.Users, "Northwind team", "12 members"], ["private", I2.Shield, "Only people invited", "Most private"]].map(o => {
                const on = access === o[0];
                const OIco = o[1];
                return (
                  <button key={o[0]} onClick={() => setAccess(o[0])} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: "var(--r)", border: "1px solid", borderColor: on ? "var(--accent)" : "transparent", background: on ? "var(--accent-soft)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                    <OIco size={17} style={{ color: on ? "var(--accent-ink)" : "var(--ink-2)" }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{o[2]}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-4)" }}>{o[3]}</span>
                    </span>
                    {on && <I2.Check size={16} style={{ color: "var(--accent-ink)" }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OWN CLOUD STORAGE — signature brand point */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, boxShadow: "var(--e1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <I2.Cloud size={17} style={{ color: "var(--ink-2)" }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Stored in your cloud</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--r)", background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "oklch(0.62 0.11 145)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><I2.Cloud size={16} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Google Drive</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>/Recio/2026/activation.mp4</div>
              </div>
              <Tag2 tone="accent"><I2.Check size={11} /> Synced</Tag2>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--ink-3)" }}>Your recordings live in <b style={{ color: "var(--ink-2)" }}>your</b> storage — not ours. Cancel anytime and keep every file.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.Screens2 = { Player, ReviewScreen, ShareScreen };
Object.assign(window, { Player, ReviewScreen, ShareScreen });
