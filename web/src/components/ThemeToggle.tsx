/** Light / Dark / System theme switch. Reads + writes the theme store; the
 *  store handles persistence, the `.dark` class and OS tracking.
 *
 *  - default: a labelled segmented control (Settings → Appearance)
 *  - `compact`: an icon-only segmented control (app sidebar) */
import type { CSSProperties } from "react";
import { useThemeStore, type ThemeMode } from "../stores/themeStore.js";
import { Icons } from "./recio/icons.js";
import type { IconComponent } from "./recio/icons.js";

const OPTIONS: { value: ThemeMode; label: string; Icon: IconComponent }[] = [
  { value: "light", label: "Light", Icon: Icons.Sun },
  { value: "dark", label: "Dark", Icon: Icons.Moon },
  { value: "system", label: "System", Icon: Icons.Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const wrap: CSSProperties = {
    display: "inline-flex",
    gap: 2,
    padding: 3,
    borderRadius: "var(--r)",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
  };

  return (
    <div role="group" aria-label="Theme" style={wrap}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value;
        const btn: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: compact ? 6 : "6px 12px",
          height: compact ? 30 : 32,
          width: compact ? 32 : undefined,
          borderRadius: "var(--r-sm)",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 600,
          background: active ? "var(--surface)" : "transparent",
          color: active ? "var(--ink)" : "var(--ink-3)",
          boxShadow: active ? "var(--e1)" : "none",
          transition: "background var(--t1), color var(--t1)",
        };
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={active}
            title={label}
            style={btn}
          >
            <Icon size={16} />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
