/** Light/dark theme state (Zustand).
 *
 *  `mode` is the user's choice — "light" | "dark" | "system" — persisted to
 *  localStorage under THEME_KEY. `resolved` is what that currently renders to
 *  ("light" | "dark"), which in "system" mode tracks `prefers-color-scheme`.
 *
 *  Applying = toggling the `.dark` class on <html> (see web/src/index.css). A
 *  matching inline script in index.html applies the class pre-paint to avoid a
 *  flash; keep THEME_KEY in sync with that script. */
import { create } from "zustand";

export const THEME_KEY = "vyooom-theme";
export type ThemeMode = "light" | "dark" | "system";

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore (SSR / blocked storage) */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

/** Toggle the `.dark` class + keep the address-bar theme-color meta in sync. */
function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0b0d12" : "#ffffff");
}

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  /** Apply the stored mode + subscribe to OS changes. Returns a cleanup fn. */
  init: () => () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readStoredMode(),
  resolved: resolve(readStoredMode()),

  init: () => {
    const { mode } = get();
    const resolved = resolve(mode);
    apply(resolved);
    set({ resolved });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (get().mode !== "system") return;
      const next = systemPrefersDark() ? "dark" : "light";
      apply(next);
      set({ resolved: next });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  },

  setMode: (mode) => {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* ignore */
    }
    const resolved = resolve(mode);
    apply(resolved);
    set({ mode, resolved });
  },
}));
