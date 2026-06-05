/** Authenticated app shell: fixed left sidebar (nav + account) + scrolling content. */
import { clsx } from "clsx";
import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/authStore.js";
import { BoardIcon, LibraryIcon, Logo, SettingsIcon } from "./icons.js";

const NAV = [
  { to: "/dashboard", label: "Library", Icon: LibraryIcon },
  { to: "/whiteboard", label: "Whiteboard", Icon: BoardIcon },
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
        <div className="flex items-center gap-2.5 px-5 py-4 text-text-primary">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-highlight">
            <Logo width={16} height={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Recio</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-bg-primary font-medium text-text-primary"
                    : "text-muted hover:bg-bg-primary/70 hover:text-text-primary",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-highlight" />
                  )}
                  <Icon width={17} height={17} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {user?.plan === "FREE" && (
            <NavLink
              to="/pricing"
              className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-highlight/15 px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-highlight/40 transition-colors hover:bg-highlight/25"
            >
              Upgrade to Pro
              <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">PRO</span>
            </NavLink>
          )}
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
