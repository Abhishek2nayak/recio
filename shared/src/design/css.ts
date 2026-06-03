/**
 * Emit the design tokens as a CSS custom-property block. Both surfaces inject this
 * at `:root` so raw CSS, Tailwind arbitrary values, and inline styles all read from
 * one source. Variable names mirror the spec exactly (e.g. `--bg-primary`).
 */
import { colors, fonts, radii } from "./tokens.js";

const COLOR_VAR_NAMES: Record<keyof typeof colors, string> = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgCard: "--bg-card",
  border: "--border",
  textPrimary: "--text-primary",
  textMuted: "--text-muted",
  accent: "--accent",
  accentHover: "--accent-hover",
  success: "--success",
  danger: "--danger",
  warning: "--warning",
};

/** Returns the inner declarations (no selector) so callers can wrap in `:root {}`. */
export function cssVariableDeclarations(): string {
  const lines: string[] = [];
  for (const [key, varName] of Object.entries(COLOR_VAR_NAMES)) {
    lines.push(`  ${varName}: ${colors[key as keyof typeof colors]};`);
  }
  lines.push(`  --font-sans: ${fonts.sans};`);
  lines.push(`  --font-mono: ${fonts.mono};`);
  lines.push(`  --radius-md: ${radii.md};`);
  lines.push(`  --radius-lg: ${radii.lg};`);
  return lines.join("\n");
}

/** Full `:root { … }` block, ready to drop into a stylesheet. */
export function rootCss(): string {
  return `:root {\n${cssVariableDeclarations()}\n}`;
}
