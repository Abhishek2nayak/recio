/**
 * FlowCap design tokens — the single source of truth for the visual system.
 *
 * NON-NEGOTIABLE: electric blue accent ONLY (no purple), Geist Sans + JetBrains
 * Mono (never Inter), dark-mode first. Both the web app and the extension popup
 * consume these via the generated CSS variables (see `css.ts`) and the Tailwind
 * preset (see `tailwind.ts`).
 */

export const colors = {
  bgPrimary: "#0A0A0B", // near black
  bgSecondary: "#111113",
  bgCard: "#18181B",
  border: "#27272A",
  textPrimary: "#FAFAFA",
  textMuted: "#71717A",
  accent: "#3B82F6", // electric blue — the only accent hue
  accentHover: "#2563EB",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
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
