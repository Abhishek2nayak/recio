/**
 * Vyooom shared primitives — ported from the design handoff (`recio-ui.jsx`) to
 * typed React. Inline styles read straight from the CSS token variables so these
 * stay pixel-faithful to the prototype and re-theme automatically (Pulse / Tide /
 * Ink) via `[data-theme]`.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icons, ReticleMark, type IconComponent } from "./icons.js";

/* ---------------- Logo ---------------- */
// Vyooom brand lockup. The mark + wordmark are full-colour blue PNGs (live in
// web/public/assets) that read on both light and dark surfaces, so they need no
// recolouring. `wordmark={false}` renders the square mark alone (favicon-style).
export function Logo({
  size = 22,
  wordmark = true,
  live = false,
}: {
  size?: number;
  wordmark?: boolean;
  live?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.5 }} aria-label="Vyooom">
      <img
        src="/assets/vyoom-icon.png"
        alt=""
        width={size}
        height={size}
        style={{
          display: "block",
          borderRadius: "26%",
          ...(live ? { animation: "r-pulse-ring 1.6s var(--ease) infinite" } : {}),
        }}
      />
      {wordmark && (
        <img src="/assets/vyoom-wordmark.png" alt="Vyooom" style={{ display: "block", height: size * 0.62, width: "auto" }} />
      )}
    </span>
  );
}

/* ---------------- Button ---------------- */
type BtnVariant = "primary" | "dark" | "soft" | "ghost" | "outline" | "hud" | "danger";
type BtnSize = "sm" | "md" | "lg";

export function RButton({
  children,
  variant = "primary",
  size = "md",
  icon: Ico,
  iconRight: IcoR,
  onClick,
  full,
  style,
  disabled,
  title,
  type = "button",
}: {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconComponent;
  iconRight?: IconComponent;
  onClick?: () => void;
  full?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  const pad = size === "sm" ? "0 12px" : size === "lg" ? "0 22px" : "0 16px";
  const hgt = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  const fs = size === "sm" ? 13 : size === "lg" ? 16 : 14;
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: hgt,
    padding: pad,
    fontFamily: "var(--sans)",
    fontSize: fs,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    borderRadius: "var(--r)",
    cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    width: full ? "100%" : "auto",
    transition:
      "transform var(--t1) var(--ease), background var(--t1), box-shadow var(--t1), border-color var(--t1)",
    transform: press ? "translateY(0.5px) scale(0.985)" : "none",
    opacity: disabled ? 0.5 : 1,
    userSelect: "none",
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: {
      background: hov ? "var(--accent-2)" : "var(--accent)",
      color: "var(--accent-on)",
      boxShadow: hov ? "var(--e2)" : "var(--e1)",
    },
    dark: {
      background: hov ? "oklch(0.30 0.013 262)" : "var(--ink)",
      color: "white",
      boxShadow: hov ? "var(--e2)" : "var(--e1)",
    },
    soft: {
      background: hov ? "var(--surface-3)" : "var(--surface-2)",
      color: "var(--ink)",
      borderColor: "var(--line)",
    },
    ghost: { background: hov ? "var(--surface-2)" : "transparent", color: "var(--ink-2)" },
    outline: {
      background: hov ? "var(--surface-2)" : "var(--surface)",
      color: "var(--ink)",
      borderColor: "var(--line-2)",
      boxShadow: "var(--e1)",
    },
    hud: {
      background: hov ? "var(--hud-2)" : "rgba(255,255,255,.07)",
      color: "var(--hud-ink)",
      borderColor: "var(--hud-line)",
    },
    danger: { background: hov ? "oklch(0.55 0.2 25)" : "oklch(0.6 0.2 25)", color: "white" },
  };
  return (
    <button
      type={type}
      title={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => {
        setHov(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {Ico && <Ico size={fs + 3} />}
      {children}
      {IcoR && <IcoR size={fs + 3} />}
    </button>
  );
}

/* ---------------- IconButton ---------------- */
export function IconBtn({
  icon: Ico,
  onClick,
  active,
  tone = "light",
  size = 38,
  title,
  style,
  badge,
}: {
  icon: IconComponent;
  onClick?: () => void;
  active?: boolean;
  tone?: "light" | "hud";
  size?: number;
  title?: string;
  style?: CSSProperties;
  badge?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const dark = tone === "hud";
  const bg = active
    ? dark
      ? "rgba(255,255,255,.14)"
      : "var(--accent-soft)"
    : hov
      ? dark
        ? "rgba(255,255,255,.09)"
        : "var(--surface-2)"
      : "transparent";
  const col = active
    ? dark
      ? "var(--hud-ink)"
      : "var(--accent-ink)"
    : dark
      ? "var(--hud-ink-2)"
      : "var(--ink-2)";
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-sm)",
        border: "none",
        background: bg,
        color: col,
        cursor: "pointer",
        transition: "background var(--t1), color var(--t1)",
        ...style,
      }}
    >
      <Ico size={Math.round(size * 0.5)} />
      {badge ? (
        <span
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: 99,
            background: "var(--accent)",
          }}
        />
      ) : null}
    </button>
  );
}

/* ---------------- Chip / Badge ---------------- */
export function Chip({
  children,
  active,
  onClick,
  icon: Ico,
}: {
  children?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: IconComponent;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 13px",
        borderRadius: "var(--r-pill)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        cursor: "pointer",
        border: "1px solid",
        borderColor: active ? "transparent" : "var(--line)",
        background: active ? "var(--ink)" : hov ? "var(--surface-2)" : "var(--surface)",
        color: active ? "white" : "var(--ink-2)",
        transition: "all var(--t1)",
      }}
    >
      {Ico && <Ico size={15} />}
      {children}
    </button>
  );
}

export function Tag({
  children,
  tone = "neutral",
  style,
}: {
  children?: ReactNode;
  tone?: "neutral" | "accent" | "live";
  style?: CSSProperties;
}) {
  const tones = {
    neutral: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent-ink)" },
    live: { bg: "color-mix(in oklch, var(--live) 16%, transparent)", fg: "var(--live)" },
  } as const;
  const t = tones[tone];
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
        background: t.bg,
        color: t.fg,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------- Avatar ---------------- */
export type Person = { name: string; hue: number };
export const AV_TONES: [number, string][] = [
  [210, "AK"],
  [150, "TM"],
  [40, "JD"],
  [300, "RS"],
  [255, "LP"],
  [12, "MV"],
];

export function Avatar({
  name = "AK",
  hue = 210,
  size = 30,
  ring,
}: {
  name?: string;
  hue?: number;
  size?: number;
  ring?: boolean;
}) {
  const init = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `oklch(0.62 0.11 ${hue})`,
        color: "white",
        fontSize: size * 0.38,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        boxShadow: ring ? "0 0 0 2.5px var(--surface)" : "none",
        flexShrink: 0,
      }}
    >
      {init}
    </span>
  );
}

export function AvatarStack({
  people = [],
  size = 28,
  max = 4,
}: {
  people?: Person[];
  size?: number;
  max?: number;
}) {
  const show = people.slice(0, max);
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {show.map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -size * 0.32 : 0, zIndex: show.length - i }}>
          <Avatar {...p} size={size} ring />
        </span>
      ))}
      {people.length > max && (
        <span
          style={{
            marginLeft: -size * 0.32,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--surface-3)",
            color: "var(--ink-2)",
            fontSize: size * 0.34,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 2.5px var(--surface)",
          }}
        >
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

/* ---------------- Toggle ---------------- */
export function Toggle({
  on,
  onChange,
  tone = "light",
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  tone?: "light" | "hud";
}) {
  const dark = tone === "hud";
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 40,
        height: 23,
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        padding: 2,
        background: on ? "var(--accent)" : dark ? "rgba(255,255,255,.18)" : "var(--line-2)",
        transition: "background var(--t2)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "white",
          boxShadow: "var(--e1)",
          transform: on ? "translateX(17px)" : "none",
          transition: "transform var(--t2) var(--ease)",
        }}
      />
    </button>
  );
}

/* ---------------- Waveform (animated) ---------------- */
export function Waveform({
  bars = 22,
  color = "var(--live)",
  active = true,
  height = 22,
  width = 2.5,
}: {
  bars?: number;
  color?: string;
  active?: boolean;
  height?: number;
  width?: number;
}) {
  const seeds = useRef(Array.from({ length: bars }, () => 0.25 + Math.random() * 0.75));
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      seeds.current = seeds.current.map(() => 0.18 + Math.random() * 0.82);
      force((n) => n + 1);
    }, 120);
    return () => clearInterval(id);
  }, [active]);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: width, height }}>
      {seeds.current.map((s, i) => (
        <span
          key={i}
          style={{
            width,
            borderRadius: 99,
            background: color,
            height: Math.max(3, (active ? s : 0.16) * height),
            transition: "height 130ms var(--ease)",
          }}
        />
      ))}
    </span>
  );
}

/* ---------------- Progress ring ---------------- */
export function Ring({
  value = 0,
  size = 18,
  sw = 2.5,
  color = "var(--accent)",
  track = "var(--line)",
}: {
  value?: number;
  size?: number;
  sw?: number;
  color?: string;
  track?: string;
}) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        style={{ transition: "stroke-dashoffset var(--t2) linear" }}
      />
    </svg>
  );
}

/* ---------------- Kbd ---------------- */
export function Kbd({ children }: { children?: ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 20,
        padding: "0 5px",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--ink-3)",
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: 5,
        boxShadow: "0 1px 0 var(--line-2)",
      }}
    >
      {children}
    </span>
  );
}

/* ---------------- Thumb placeholder ---------------- */
export function Thumb({
  label = "capture",
  hue = 230,
  duration = "1:24",
  ratio = "16 / 10",
  style,
  accent = false,
  src,
}: {
  label?: string;
  hue?: number;
  duration?: string;
  ratio?: string;
  style?: CSSProperties;
  accent?: boolean;
  src?: string | null;
}) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: ratio,
        borderRadius: "var(--r)",
        overflow: "hidden",
        background: "var(--hud)",
        border: "1px solid var(--line)",
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(120% 120% at 30% 18%, oklch(0.32 0.04 ${hue}) 0%, oklch(0.2 0.02 ${hue}) 55%, oklch(0.16 0.012 262) 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0 1px, transparent 1px 11px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "22%",
              color: accent ? "var(--accent)" : "rgba(255,255,255,.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ReticleMark size="38%" sw={1.4} dot={false} color="currentColor" />
          </div>
        </>
      )}
      <span
        className="mono"
        style={{
          position: "absolute",
          left: 9,
          top: 8,
          fontSize: 10,
          color: "rgba(255,255,255,.6)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          fontSize: 11,
          fontWeight: 600,
          color: "white",
          background: "rgba(0,0,0,.42)",
          padding: "2px 6px",
          borderRadius: 5,
          backdropFilter: "blur(4px)",
        }}
      >
        {duration}
      </span>
    </div>
  );
}

/* ---------------- Webcam bubble ---------------- */
export function WebcamBubble({
  size = 132,
  hue = 255,
  ring = true,
  live = true,
  label = "you",
}: {
  size?: number;
  hue?: number;
  ring?: boolean;
  live?: boolean;
  label?: string;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "var(--e-hud)",
          border: ring ? "3px solid var(--accent)" : "3px solid rgba(255,255,255,.8)",
          animation: live && ring ? "r-pulse-ring 2.4s var(--ease) infinite" : "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 100% at 35% 25%, oklch(0.55 0.09 ${hue}) 0%, oklch(0.32 0.05 ${hue}) 60%, oklch(0.2 0.02 ${hue}) 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.4,
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(255,255,255,.05) 0 1px, transparent 1px 9px)",
          }}
        />
        <span
          className="mono"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "30%",
            textAlign: "center",
            fontSize: 11,
            color: "rgba(255,255,255,.55)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      {live && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 13,
            height: 13,
            borderRadius: 99,
            background: "var(--live)",
            boxShadow: "0 0 0 3px var(--hud)",
            animation: "r-live-blink 1.6s steps(1) infinite",
          }}
        />
      )}
    </div>
  );
}

export { Icons, ReticleMark };
