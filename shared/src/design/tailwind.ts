/**
 * A Tailwind theme fragment built from the design tokens. Web and extension import
 * this into their `tailwind.config` so utility classes (`bg-surface`, `text-ink-2`,
 * `border-line`, `bg-highlight`, `font-mono`…) resolve to the canonical palette — no
 * hardcoded hexes.
 *
 * Naming follows the established codebase semantics so pre-redesign pages keep
 * working without edits:
 *  - `accent` = INK (near-black) — the primary action color (black buttons, links).
 *  - `highlight` = the single electric pop (default Vyooom blue) — record button,
 *    active states, focus rings, CTAs. Text on SOLID highlight uses `accent-on`
 *    (near-white); accent-colored text on neutral surfaces uses `accent-ink`.
 * New Recio screens style themselves from the CSS variables (`var(--accent)` etc.),
 * which carry the green and re-theme via `[data-theme]`; Tailwind here mainly backs
 * the older pages plus the shared neutral palette.
 */
import { colors, fontSizes, fonts, radii, spacing } from "./tokens.js";

const INK_HOVER = "oklch(0.15 0.01 262)";

export const tailwindTheme = {
  colors: {
    transparent: "transparent",
    current: "currentColor",
    white: "#ffffff",
    black: "#000000",

    /* ── Recio neutral palette ── */
    paper: colors.paper,
    surface: colors.surface,
    "surface-2": colors.surface2,
    "surface-3": colors.surface3,
    line: colors.line,
    "line-2": colors.line2,
    ink: colors.ink,
    "ink-2": colors.ink2,
    "ink-3": colors.ink3,
    "ink-4": colors.ink4,
    hud: colors.hud,
    "hud-2": colors.hud2,
    "hud-line": colors.hudLine,
    "hud-ink": colors.hudInk,
    "hud-ink-2": colors.hudInk2,

    /* ── action color = ink (black) ── */
    accent: colors.ink,
    "accent-hover": INK_HOVER,

    /* ── electric pop = Vyooom blue (the "highlight") ── */
    highlight: colors.accent,
    "highlight-hover": colors.accent2,
    "accent-soft": colors.accentSoft,
    "accent-ink": colors.accentInk,
    "accent-on": colors.accentOn,
    "accent-ring": colors.accentRing,
    live: colors.live,

    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,

    /* ── legacy aliases → re-pointed at the new neutral palette ── */
    "bg-primary": colors.paper,
    "bg-secondary": colors.surface,
    card: colors.surface,
    border: colors.line,
    "text-primary": colors.ink,
    muted: colors.ink2,
  },
  fontFamily: {
    sans: [fonts.sans],
    mono: [fonts.mono],
  },
  fontSize: fontSizes,
  borderRadius: radii,
  spacing,
} as const;
