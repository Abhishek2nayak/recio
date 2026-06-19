/**
 * WorkCanvas — a believable generic productivity screen rendered *behind* the
 * recording overlay, so the live capture frame + HUD have something to sit on top
 * of. Ported from the handoff. Not a real brand; a product spec board.
 */
import { Avatar, AvatarStack } from "./primitives.js";

const COLS = [
  {
    t: "Discovery",
    n: 3,
    items: [
      ["Audit current onboarding", 210],
      ["User interviews · round 2", 150],
    ] as [string, number][],
  },
  {
    t: "In progress",
    n: 4,
    items: [
      ["Activation funnel redesign", 40],
      ["Empty-state illustrations", 300],
      ["Mobile capture flow", 255],
    ] as [string, number][],
  },
  { t: "Review", n: 2, items: [["Pricing page copy", 12]] as [string, number][] },
];

export function WorkCanvas() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--surface-2)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* fake app topbar */}
      <div
        style={{
          height: 52,
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {["oklch(0.8 0.08 25)", "oklch(0.85 0.09 85)", "oklch(0.82 0.09 150)"].map((c, i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />
          ))}
        </div>
        <div style={{ marginLeft: 8, fontWeight: 700, fontSize: 14, color: "var(--ink-2)" }}>
          Northwind · Product
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            marginLeft: 18,
            color: "var(--ink-3)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span style={{ padding: "5px 10px", borderRadius: 7, background: "var(--surface-2)", color: "var(--ink)" }}>
            Board
          </span>
          <span style={{ padding: "5px 10px" }}>Timeline</span>
          <span style={{ padding: "5px 10px" }}>Docs</span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <AvatarStack
            people={[
              { name: "AK", hue: 210 },
              { name: "TM", hue: 150 },
              { name: "JD", hue: 40 },
            ]}
            size={26}
          />
        </div>
      </div>
      {/* board */}
      <div style={{ display: "flex", gap: 18, padding: 22, height: "calc(100% - 52px)" }}>
        {COLS.map((c, ci) => (
          <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: "var(--ink-2)",
              }}
            >
              {c.t}
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>
                {c.n}
              </span>
            </div>
            {c.items.map(([title, hue], ii) => (
              <div
                key={ii}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: "var(--e1)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 6,
                    borderRadius: 99,
                    background: `oklch(0.78 0.1 ${hue})`,
                    marginBottom: 11,
                  }}
                />
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                    marginBottom: 12,
                    lineHeight: 1.35,
                  }}
                >
                  {title}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Avatar name={["AK", "TM", "JD", "RS"][(ci + ii) % 4]} hue={hue} size={22} />
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                    RC-{120 + ci * 7 + ii}
                  </span>
                </div>
              </div>
            ))}
            <div
              style={{
                height: 36,
                borderRadius: 10,
                border: "1.5px dashed var(--line-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-4)",
                fontSize: 18,
              }}
            >
              +
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
