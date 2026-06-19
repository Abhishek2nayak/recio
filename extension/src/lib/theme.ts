/**
 * Applies the chosen light/dark mode to an extension page (popup, studio).
 *
 * The stylesheet (`styles/global.css`) defines the dark palette under
 * `:root.dark` (force) and `@media (prefers-color-scheme: dark) :root:not(.light)`
 * (system default). So we only need to toggle two classes on <html>:
 *   - "dark"  → force dark
 *   - "light" → force light (opt out of the OS media query)
 *   - neither → follow the OS
 */
import { getSettings, type ThemeMode } from "./storage.js";

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
}

/** Read the persisted mode and apply it. Call once on page mount. */
export async function initTheme(): Promise<ThemeMode> {
  const { theme } = await getSettings();
  applyTheme(theme);
  return theme;
}

/** Cycle light → dark → system (for a single-button toggle). */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
}
