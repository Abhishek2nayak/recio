/** Authenticated app shell: fixed left sidebar (nav + account) + scrolling content. */
import { clsx } from "clsx";
import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/authStore.js";
import { LibraryIcon, Logo, SettingsIcon } from "./icons.js";

const NAV = [
  { to: "/dashboard", label: "Library", Icon: LibraryIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-bg-secondary">
        <div className="flex items-center gap-2 px-5 py-4 text-text-primary">
          <Logo className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">FlowCap</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-card text-text-primary"
                    : "text-muted hover:bg-card/60 hover:text-text-primary",
                )
              }
            >
              <Icon width={17} height={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text-primary">{user?.name ?? "Account"}</p>
              <p className="truncate font-mono text-[10px] text-muted">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 text-[11px] text-muted hover:text-text-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="h-full flex-1 overflow-y-auto bg-bg-primary">{children}</main>
    </div>
  );
}
