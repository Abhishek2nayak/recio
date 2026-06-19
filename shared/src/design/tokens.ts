/**
 * Recio design tokens — the single source of truth for the visual system.
 *
 * Concept: framing & transferring knowledge. A cool, light-first neutral base
 * (off-white surfaces + near-black "ink" text) with a single electric accent and
 * a near-black recording HUD. Two type families: Hanken Grotesk (UI/display) +
 * JetBrains Mono (timecodes, labels, metadata).
 *
 * Both the web app and the extension consume these via the generated CSS
 * variables (see `css.ts`) and the Tailwind preset (see `tailwind.ts`). Values
 * are authored in `oklch` for perceptual consistency; modern evergreen browsers
 * (the only targets here) render them natively.
 *
 * COLOR RULES:
 *  - `ink` (and its 2/3/4 steps) is the text scale on light surfaces.
 *  - `accent` is the ONE electric pop (default = Pulse green). It carries the
 *    record button, active states, focus rings, progress and the "live" frame.
 *    Text on top of it must use `accentInk` (never white — white-on-green fails
 *    contrast). `accentSoft` is its tinted surface.
 *  - `hud*` is the near-black recording overlay glass (controls, countdown).
 *  - Theme variants (Tide cyan, Ink monochrome) re-point the accent group via
 *    `[data-theme]` selectors in CSS — see `css.ts` / the app stylesheets.
 */

export const colors = {
  /* cool neutral surfaces (light-first) */
  paper: "oklch(0.984 0.003 255)", // page background
  surface: "oklch(1 0 0)", // card / panel background
  surface2: "oklch(0.972 0.004 255)", // subtle inset
  surface3: "oklch(0.955 0.005 255)", // deeper inset
  line: "oklch(0.918 0.005 258)", // default border
  line2: "oklch(0.872 0.006 258)", // stronger border

  /* ink (text) */
  ink: "oklch(0.235 0.013 262)", // primary text
  ink2: "oklch(0.455 0.011 262)", // secondary text
  ink3: "oklch(0.612 0.009 262)", // tertiary text
  ink4: "oklch(0.722 0.007 262)", // placeholder / metadata

  /* near-black recording HUD glass */
  hud: "oklch(0.205 0.011 262)",
  hud2: "oklch(0.262 0.012 262)",
  hudLine: "oklch(0.36 0.012 262)",
  hudInk: "oklch(0.96 0.004 255)",
  hudInk2: "oklch(0.74 0.008 258)",

  /* accent — Vyooom brand blue (default). Pulse (green) / Ink (mono) remain
     opt-in via [data-theme]. */
  accent: "oklch(0.55 0.2 258)", // saturated brand blue (~#2563EB)
  accent2: "oklch(0.49 0.21 258)", // hover (~#1D4ED8)
  // Foreground on SOLID accent surfaces (buttons, badges) — near-white. Blue is
  // dark enough that white reads cleanly on it (passes AA).
  accentOn: "oklch(0.99 0.01 258)",
  // Accent-COLORED ink on neutral/soft surfaces (links, active nav, mentions,
  // soft-tint text). A mid-deep blue readable on white + the pale tint.
  accentInk: "oklch(0.5 0.19 258)",
  accentSoft: "oklch(0.95 0.035 258)", // tinted surface
  accentRing: "oklch(0.55 0.2 258 / 0.35)", // focus ring
  live: "oklch(0.58 0.21 258)", // recording indicator

  /* status */
  success: "oklch(0.7 0.16 150)",
  danger: "oklch(0.6 0.2 25)",
  warning: "oklch(0.72 0.16 70)",
} as const;
export type ColorToken = keyof typeof colors;

/**
 * Hex approximations for tooling that can't render oklch (emails, OG images,
 * native config). Kept in sync with the oklch values above.
 */
export const colorsHex = {
  paper: "#F8F8FC",
  surface: "#FFFFFF",
  surface2: "#F3F3F8",
  surface3: "#EEEEF4",
  line: "#E4E4ED",
  line2: "#D7D7E1",
  ink: "#2A2A38",
  ink2: "#626274",
  ink3: "#8E8EA0",
  ink4: "#AEAEBF",
  hud: "#28283A",
  hud2: "#393949",
  hudLine: "#52525F",
  hudInk: "#F2F2F5",
  hudInk2: "#A9A9B6",
  accent: "#2563EB",
  accentOn: "#FFFFFF",
  accentInk: "#2459D6",
  accentSoft: "#E9F1FE",
  live: "#2F6BF0",
  success: "#37C871",
  danger: "#DC2626",
  warning: "#D97706",
} as const;

/**
 * Dark-mode re-points. Applied under `.dark` (web) / `prefers-color-scheme:
 * dark` (extension). Only the surface/ink scale and a brighter accent change —
 * the near-black HUD glass is already dark and is reused as-is. `accentOn`
 * stays near-white (white on solid blue reads in both modes); `accentInk` flips
 * to a LIGHT blue so accent-colored text/tints stay legible on dark surfaces.
 */
export const colorsDark = {
  paper: "oklch(0.17 0.008 262)",
  surface: "oklch(0.205 0.011 262)",
  surface2: "oklch(0.245 0.012 262)",
  surface3: "oklch(0.285 0.013 262)",
  line: "oklch(0.32 0.013 262)",
  line2: "oklch(0.4 0.014 262)",
  ink: "oklch(0.96 0.004 255)",
  ink2: "oklch(0.74 0.008 258)",
  ink3: "oklch(0.61 0.01 260)",
  ink4: "oklch(0.5 0.011 260)",
  accent: "oklch(0.62 0.19 258)",
  accent2: "oklch(0.56 0.2 258)",
  accentOn: "oklch(0.99 0.01 258)",
  accentInk: "oklch(0.74 0.15 256)",
  accentSoft: "oklch(0.3 0.07 262)",
  accentRing: "oklch(0.62 0.19 258 / 0.45)",
  live: "oklch(0.64 0.2 258)",
  success: "oklch(0.72 0.16 150)",
  danger: "oklch(0.66 0.2 25)",
  warning: "oklch(0.75 0.16 70)",
} as const;

export const fonts = {
  /** UI / display text. */
  sans: '"Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  /** Timecodes, labels, byte sizes, share tokens. */
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
} as const;

export const radii = {
  sm: "7px", // small inputs, tags
  md: "11px", // standard buttons, inputs
  lg: "16px", // cards, panels
  xl: "22px", // large panels
  "2xl": "30px", // modals
  full: "999px", // chips, pills
} as const;

/** Soft, cool elevation scale (+ the deep HUD shadow). */
export const elevation = {
  e1: "0 1px 2px rgba(18,20,28,.05), 0 1px 1px rgba(18,20,28,.04)",
  e2: "0 6px 16px -4px rgba(18,20,28,.10), 0 2px 5px -2px rgba(18,20,28,.06)",
  e3: "0 18px 44px -12px rgba(18,20,28,.20), 0 5px 12px -6px rgba(18,20,28,.10)",
  hud: "0 24px 60px -12px rgba(0,0,0,.55), 0 6px 18px -6px rgba(0,0,0,.4), 0 0 0 .5px rgba(255,255,255,.06) inset",
} as const;

/** 4px base scale. */
export const spacing = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const fontSizes = {
  xs: "11px",
  sm: "13px",
  base: "14px",
  md: "15px",
  lg: "19px",
  xl: "22px",
  "2xl": "27px",
  "3xl": "36px",
} as const;

/** Standard easings/durations so motion feels consistent (Framer Motion + CSS). */
export const motion = {
  fast: 0.12, // --t1 micro (hover)
  base: 0.22, // --t2 standard (toggle, slide)
  slow: 0.36, // --t3 entrance
  ease: [0.2, 0.7, 0.2, 1] as const,
  easeOut: [0.16, 1, 0.3, 1] as const,
} as const;
