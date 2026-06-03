/**
 * A Tailwind theme fragment built from the design tokens. Web and extension import
 * this into their `tailwind.config` so utility classes (`bg-card`, `text-muted`,
 * `text-accent`, `font-mono`…) resolve to the canonical palette — no hardcoded hexes.
 */
import { colors, fontSizes, fonts, radii, spacing } from "./tokens.js";

export const tailwindTheme = {
  colors: {
    transparent: "transparent",
    current: "currentColor",
    "bg-primary": colors.bgPrimary,
    "bg-secondary": colors.bgSecondary,
    card: colors.bgCard,
    border: colors.border,
    "text-primary": colors.textPrimary,
    muted: colors.textMuted,
    accent: colors.accent,
    "accent-hover": colors.accentHover,
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
  },
  fontFamily: {
    sans: [fonts.sans],
    mono: [fonts.mono],
  },
  fontSize: fontSizes,
  borderRadius: radii,
  spacing,
} as const;
