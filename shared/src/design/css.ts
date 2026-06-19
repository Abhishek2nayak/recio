/**
 * Emit the design tokens as CSS custom-property blocks. Both surfaces inject these
 * at `:root` so raw CSS, Tailwind arbitrary values, and inline styles all read from
 * one source. Variable names mirror the prototype spec exactly (e.g. `--surface`,
 * `--ink-2`, `--accent-soft`, `--r-lg`, `--e2`, `--t2`).
 *
 * `themeCss()` returns the `[data-theme="…"]` overrides that re-point the accent
 * group for the Pulse (green) and Ink (monochrome) directions. Default `:root` is
 * Vyooom brand blue. `darkCss()` returns the light/dark mode override.
 */
import { colors, colorsDark, elevation, fonts, radii } from "./tokens.js";

/** Variable names for the subset of tokens that change in dark mode. */
const DARK_VAR_NAMES: Record<keyof typeof colorsDark, string> = {
  paper: "--paper",
  surface: "--surface",
  surface2: "--surface-2",
  surface3: "--surface-3",
  line: "--line",
  line2: "--line-2",
  ink: "--ink",
  ink2: "--ink-2",
  ink3: "--ink-3",
  ink4: "--ink-4",
  accent: "--accent",
  accent2: "--accent-2",
  accentOn: "--accent-on",
  accentInk: "--accent-ink",
  accentSoft: "--accent-soft",
  accentRing: "--accent-ring",
  live: "--live",
  success: "--success",
  danger: "--danger",
  warning: "--warning",
};

const COLOR_VAR_NAMES: Record<keyof typeof colors, string> = {
  paper: "--paper",
  surface: "--surface",
  surface2: "--surface-2",
  surface3: "--surface-3",
  line: "--line",
  line2: "--line-2",
  ink: "--ink",
  ink2: "--ink-2",
  ink3: "--ink-3",
  ink4: "--ink-4",
  hud: "--hud",
  hud2: "--hud-2",
  hudLine: "--hud-line",
  hudInk: "--hud-ink",
  hudInk2: "--hud-ink-2",
  accent: "--accent",
  accent2: "--accent-2",
  accentOn: "--accent-on",
  accentInk: "--accent-ink",
  accentSoft: "--accent-soft",
  accentRing: "--accent-ring",
  live: "--live",
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
  lines.push(`  --sans: ${fonts.sans};`);
  lines.push(`  --mono: ${fonts.mono};`);
  lines.push(`  --r-sm: ${radii.sm};`);
  lines.push(`  --r: ${radii.md};`);
  lines.push(`  --r-lg: ${radii.lg};`);
  lines.push(`  --r-xl: ${radii.xl};`);
  lines.push(`  --r-2xl: ${radii["2xl"]};`);
  lines.push(`  --r-pill: ${radii.full};`);
  // legacy radius aliases used by pre-redesign pages
  lines.push(`  --radius-md: ${radii.md};`);
  lines.push(`  --radius-lg: ${radii.lg};`);
  lines.push(`  --e1: ${elevation.e1};`);
  lines.push(`  --e2: ${elevation.e2};`);
  lines.push(`  --e3: ${elevation.e3};`);
  lines.push(`  --e-hud: ${elevation.hud};`);
  lines.push(`  --ease: cubic-bezier(.2,.7,.2,1);`);
  lines.push(`  --ease-out: cubic-bezier(.16,1,.3,1);`);
  lines.push(`  --t1: 120ms;`);
  lines.push(`  --t2: 220ms;`);
  lines.push(`  --t3: 360ms;`);
  return lines.join("\n");
}

/** Full `:root { … }` block, ready to drop into a stylesheet. */
export function rootCss(): string {
  return `:root {\n${cssVariableDeclarations()}\n}`;
}

/** `[data-theme="pulse" | "ink"]` accent overrides (default `:root` is Tide cyan). */
export function themeCss(): string {
  return `[data-theme="pulse"] {
  --accent: oklch(0.77 0.175 150);
  --accent-2: oklch(0.70 0.175 150);
  --accent-ink: oklch(0.22 0.05 150);
  --accent-soft: oklch(0.95 0.045 150);
  --accent-ring: oklch(0.77 0.175 150 / 0.35);
  --live: oklch(0.77 0.175 150);
}
[data-theme="ink"] {
  --accent: oklch(0.30 0.012 262);
  --accent-2: oklch(0.22 0.012 262);
  --accent-ink: oklch(0.98 0.003 255);
  --accent-soft: oklch(0.93 0.004 258);
  --accent-ring: oklch(0.30 0.012 262 / 0.28);
  --live: oklch(0.76 0.18 150);
}`;
}

/**
 * Dark-mode overrides. Re-points the neutral surface/ink scale + accent and
 * deepens the elevation shadows. Wrap as needed: `.dark { … }` (class-toggled,
 * the web app) or `@media (prefers-color-scheme: dark) { :root { … } }` (the
 * extension, which has no toggle and just follows the OS).
 */
export function darkCssDeclarations(): string {
  const lines: string[] = [];
  for (const [key, varName] of Object.entries(DARK_VAR_NAMES)) {
    lines.push(`  ${varName}: ${colorsDark[key as keyof typeof colorsDark]};`);
  }
  // Soft cool shadows vanish on dark surfaces — switch to deeper, black-based ones.
  lines.push(`  --e1: 0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 1px rgba(0, 0, 0, 0.3);`);
  lines.push(`  --e2: 0 6px 16px -4px rgba(0, 0, 0, 0.5), 0 2px 5px -2px rgba(0, 0, 0, 0.4);`);
  lines.push(`  --e3: 0 18px 44px -12px rgba(0, 0, 0, 0.6), 0 5px 12px -6px rgba(0, 0, 0, 0.45);`);
  lines.push(`  color-scheme: dark;`);
  return lines.join("\n");
}

/** Ready-to-drop `.dark { … }` block (the web app toggles this class on <html>). */
export function darkCss(): string {
  return `.dark {\n${darkCssDeclarations()}\n}`;
}
