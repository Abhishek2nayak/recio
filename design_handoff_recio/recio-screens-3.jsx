// recio-screens-3.jsx — Dashboard / workspace (Grid + Stream variants)
const { useState: useS3 } = React;
const I3 = window.Icons;
const { Logo: Logo3, Button: Btn3, IconBtn: IB3, Chip: Chip3, Tag: Tag3, Thumb: Thumb3, Avatar: Av3, AvatarStack: AvS3, Ring: Ring3 } = window;

const CAPTURES = [
  { t: "Activation funnel redesign — walkthrough", au: "Alex Kerr", hue: 235, dur: "1:24", ago: "2m ago", views: 12, cm: 3, pct: 0, space: "Product", you: true },
  { t: "Q3 roadmap review for leadership", au: "Tara Mireles", hue: 150, dur: "8:12", ago: "Today", views: 41, cm: 9, pct: 64, space: "Product" },
  { t: "How our new auth flow works (eng deep-dive)", au: "Jonah Diaz", hue: 40, dur: "11:38", ago: "Yesterday", views: 28, cm: 6, pct: 100, space: "Engineering" },
  { t: "Onboarding empty-states — design review", au: "Riya Sharma", hue: 300, dur: "4:05", ago: "Yesterday", views: 19, cm: 4, pct: 0, space: "Design" },
  { t: "Customer call recap — Northwind Logistics", au: "Alex Kerr", hue: 25, dur: "6:47", ago: "2d ago", views: 33, cm: 2, pct: 28, space: "GTM", you: true },
  { t: "Sprint demo — capture & annotate", au: "Leo Park", hue: 255, dur: "9:21", ago: "3d ago", views: 57, cm: 12, pct: 100, space: "Engineering" },
  { t: "Pricing page copy — first pass narration", au: "Maya Vance", hue: 12, dur: "3:18", ago: "4d ago", views: 22, cm: 5, pct: 0, space: "GTM" },
  { t: "Mobile capture flow — interaction notes", au: "Riya Sharma", hue: 300, dur: "5:52", ago: "5d ago", views: 15, cm: 1, pct: 41, space: "Design" },
];

function WatchBar({ pct }) {
  if (pct >= 100) return <Tag3 tone="accent"><I3.Check size={11} /> Watched</Tag3>;
  if (pct > 0) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-4)", fontWeight: 600 }} className="mono">
      <span style={{ width: 38, height: 4, borderRadius: 99, background: "var(--line-2)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--accent)" }} /></span>{pct}%
    </span>
  );
  return <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 600 }}>New</span>;
}

function GridCard({ c, i }) {
  const [hov, setHov] = useS3(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", flexDirection: "column", gap: 11, cursor: "pointer", animation: `r-fade-up var(--t3) var(--ease) both`, animationDelay: `${i * 28}ms` }}>
      <div style={{ position: "relative", transform: hov ? "translateY(-3px)" : "none", transition: "transform var(--t2) var(--ease), box-shadow var(--t2)", borderRadius: "var(--r)", boxShadow: hov ? "var(--e3)" : "none" }}>
        <Thumb3 label={c.space} hue={c.hue} duration={c.dur} accent={c.you} />
        {hov && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--r)", background: "oklch(0.16 0.01 262 / 0.25)" }}>
          <span style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,.94)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)", boxShadow: "var(--e2)" }}><I3.Play size={18} style={{ marginLeft: 2 }} /></span>
        </div>}
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          {c.you && <Tag3 tone="accent" style={{ height: 18, fontSize: 10 }}>You</Tag3>}
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.space}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--ink)", marginBottom: 9, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textWrap: "pretty" }}>{c.t}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Av3 name={c.au} hue={c.hue} size={22} />
          <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{c.au}</span>
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>· {c.ago}</span>
          <span style={{ marginLeft: "auto" }}><WatchBar pct={c.pct} /></span>
        </div>
      </div>
    </div>
  );
}

function StreamRow({ c, i }) {
  const [hov, setHov] = useS3(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 14px", borderRadius: "var(--r-lg)", cursor: "pointer",
        background: hov ? "var(--surface)" : "transparent", boxShadow: hov ? "var(--e1)" : "none", border: "1px solid", borderColor: hov ? "var(--line)" : "transparent",
        transition: "all var(--t1)", animation: `r-fade-up var(--t2) var(--ease) both`, animationDelay: `${i * 22}ms` }}>
      <div style={{ width: 132, flexShrink: 0 }}><Thumb3 label={c.space} hue={c.hue} duration={c.dur} accent={c.you} ratio="16 / 10" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          {c.you && <Tag3 tone="accent" style={{ height: 18, fontSize: 10 }}>You</Tag3>}
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.space}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.t}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Av3 name={c.au} hue={c.hue} size={20} />
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{c.au} · {c.ago}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5 }}><I3.Eye size={14} />{c.views}</span>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5 }}><I3.Comment size={14} />{c.cm}</span>
        <span style={{ width: 78, textAlign: "right" }}><WatchBar pct={c.pct} /></span>
        <IB3 icon={I3.More} size={32} />
      </div>
    </div>
  );
}

function NavItem({ icon: Ico, label, active, count }) {
  const [hov, setHov] = useS3(false);
  return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "8px 11px", borderRadius: "var(--r)", border: "none", cursor: "pointer",
        background: active ? "var(--surface)" : hov ? "var(--surface-2)" : "transparent", boxShadow: active ? "var(--e1)" : "none",
        color: active ? "var(--ink)" : "var(--ink-2)", fontWeight: active ? 600 : 500, fontSize: 13.5, textAlign: "left", transition: "all var(--t1)" }}>
      <Ico size={18} style={{ color: active ? "var(--accent-ink)" : "var(--ink-3)" }} />
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>{count}</span>}
    </button>
  );
}

function DashboardScreen({ layout = "grid", onNew, onOpen }) {
  const [filter, setFilter] = useS3("All");
  const [view, setView] = useS3(layout);
  React.useEffect(() => setView(layout), [layout]);
  const list = filter === "Mine" ? CAPTURES.filter(c => c.you) : filter === "Shared" ? CAPTURES.filter(c => !c.you) : CAPTURES;
  const cont = CAPTURES.filter(c => c.pct > 0 && c.pct < 100).slice(0, 3);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", background: "var(--paper)" }}>
      {/* sidebar */}
      <aside style={{ width: 244, flexShrink: 0, borderRight: "1px solid var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", padding: 16 }}>
        <div style={{ padding: "4px 6px 18px" }}><Logo3 size={23} /></div>
        <Btn3 variant="primary" full icon={I3.Reticle} onClick={onNew}>New capture</Btn3>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 18 }}>
          <NavItem icon={I3.Stream} label="Library" active count={48} />
          <NavItem icon={I3.Users} label="Shared with me" count={12} />
          <NavItem icon={I3.Comment} label="Comments" count={3} />
          <NavItem icon={I3.Bolt} label="Starred" />
        </nav>
        <div style={{ marginTop: 22, marginBottom: 9, padding: "0 11px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Spaces</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[["Product", 145], ["Engineering", 40], ["Design", 300], ["GTM", 25]].map(([s, hue]) => (
            <button key={s} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 11px", borderRadius: "var(--r)", border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-2)", fontSize: 13.5, fontWeight: 500, textAlign: "left" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: `oklch(0.7 0.13 ${hue})` }} />{s}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          {/* cloud storage meter */}
          <div style={{ padding: 13, borderRadius: "var(--r-lg)", background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: "oklch(0.62 0.11 145)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><I3.Cloud size={13} /></span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Google Drive</span>
              <Ring3 value={0.36} size={16} sw={2.4} />
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>18.2 GB of 50 GB · your cloud</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 6px 2px" }}>
            <Av3 name="AK" hue={210} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>Alex Kerr</div><div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>Northwind</div></div>
            <IB3 icon={I3.Gear} size={32} />
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="r-scroll" style={{ flex: 1, overflow: "auto" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 4, display: "flex", alignItems: "center", gap: 14, padding: "16px 28px", background: "color-mix(in oklch, var(--paper) 82%, transparent)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Library</h1>
          <div style={{ flex: 1, maxWidth: 320, marginLeft: 8, height: 38, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 9, padding: "0 12px" }}>
            <I3.Search size={16} style={{ color: "var(--ink-4)" }} />
            <span style={{ fontSize: 13.5, color: "var(--ink-4)" }}>Search captions, titles, people…</span>
            <Kbd>/</Kbd>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>{["All", "Mine", "Shared"].map(f => <Chip3 key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip3>)}</div>
            <span style={{ width: 1, height: 24, background: "var(--line-2)" }} />
            <div style={{ display: "flex", padding: 3, borderRadius: "var(--r)", background: "var(--surface-2)", border: "1px solid var(--line)", gap: 2 }}>
              <IB3 icon={I3.Grid} size={30} active={view === "grid"} onClick={() => setView("grid")} />
              <IB3 icon={I3.Stream} size={30} active={view === "stream"} onClick={() => setView("stream")} />
            </div>
          </div>
        </header>

        <div style={{ padding: "24px 28px 60px" }}>
          {/* continue watching */}
          {cont.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 13, display: "flex", alignItems: "center", gap: 7 }}><I3.Clock size={15} /> Pick up where you left off</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {cont.map((c, i) => (
                  <div key={i} onClick={onOpen} style={{ display: "flex", gap: 12, padding: 12, borderRadius: "var(--r-lg)", background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--e1)", cursor: "pointer" }}>
                    <div style={{ width: 104, flexShrink: 0 }}><Thumb3 label={c.space} hue={c.hue} duration={c.dur} ratio="16 / 11" /></div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.t}</div>
                      <div style={{ marginTop: "auto", paddingTop: 8 }}>
                        <div style={{ height: 4, borderRadius: 99, background: "var(--line-2)", overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", width: `${c.pct}%`, background: "var(--accent)" }} /></div>
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.pct}% · {c.au}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 16 }}>{filter === "All" ? "All captures" : filter === "Mine" ? "Created by you" : "Shared with you"} <span className="mono" style={{ color: "var(--ink-4)", fontWeight: 600 }}>{list.length}</span></div>

          {view === "grid"
            ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))", gap: "26px 22px" }} onClick={onOpen}>{list.map((c, i) => <GridCard key={c.t} c={c} i={i} />)}</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onClick={onOpen}>{list.map((c, i) => <StreamRow key={c.t} c={c} i={i} />)}</div>}
        </div>
      </div>
    </div>
  );
}

window.Screens3 = { DashboardScreen };
Object.assign(window, { DashboardScreen });
