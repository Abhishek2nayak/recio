/**
 * Recio design tokens — the single source of truth for the visual system.
 *
 * Visual system: a disciplined neutral base (Apple-style off-white surfaces +
 * near-black ink) with a single high-energy "electric kiwi" highlight used
 * sparingly. Geist Sans + JetBrains Mono (never Inter), light-mode. Both the web
 * app and the extension popup consume these via the generated CSS variables (see
 * `css.ts`) and the Tailwind preset (see `tailwind.ts`).
 *
 * COLOR RULES:
 *  - `accent` is the INK/action color (near-black): black buttons w/ white text,
 *    readable links & icons. It is intentionally monochrome.
 *  - `highlight` (#CCFF00 kiwi) is the ONLY chromatic pop — record button, active
 *    states, badges, focus rings, progress. It MUST sit on a black foreground
 *    (white-on-kiwi is unreadable, ~1.3:1); use sparingly so it keeps its punch.
 */

export const colors = {
  bgPrimary: "#F5F5F7", // warm off-white page
  bgSecondary: "#FFFFFF",
  bgCard: "#FFFFFF",
  border: "#E5E5EA",
  textPrimary: "#1D1D1F", // near-black ink (never pure #000)
  textMuted: "#6E6E73",
  accent: "#1A1A1A", // ink — primary action color (black buttons, links)
  accentHover: "#000000",
  highlight: "#CCFF00", // electric kiwi — chromatic pop; black foreground ONLY
  highlightHover: "#BBEE00",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
} as const;
export type ColorToken = keyof typeof colors;

export const fonts = {
  /** UI text. */
  sans: '"Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  /** Metadata, timestamps, byte sizes, share tokens. */
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
} as const;

export const radii = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
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
  lg: "18px",
  xl: "22px",
  "2xl": "28px",
  "3xl": "36px",
} as const;

/** Standard easings/durations so motion feels consistent (Framer Motion + CSS). */
export const motion = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  easeOut: [0.16, 1, 0.3, 1] as const,
} as const;
