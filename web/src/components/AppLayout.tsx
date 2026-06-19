/** Authenticated app shell — the Vyooom sidebar (logo · new-capture · nav · spaces ·
 *  cloud meter · account) + scrolling content. Matches the design handoff. */
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/authStore.js";
import { Avatar, Logo, RButton, Ring } from "./recio/index.js";
import { Icons } from "./recio/icons.js";
import { ThemeToggle } from "./ThemeToggle.js";

const NAV = [
  { to: "/dashboard", label: "Library", Icon: Icons.Stream, count: undefined as number | undefined },
  { to: "/whiteboard", label: "Whiteboard", Icon: Icons.Pen },
  { to: "/team", label: "Team", Icon: Icons.Users },
  { to: "/settings", label: "Settings", Icon: Icons.Gear },
  { to: "/profile", label: "Profile", Icon: Icons.Users },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    if (!window.confirm("Sign out of Vyooom?")) return;
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full" style={{ background: "var(--paper)" }}>
      <aside
        style={{
          width: 244,
          flexShrink: 0,
          borderRight: "1px solid var(--line)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          padding: 16,
        }}
      >
        <div style={{ padding: "4px 6px 18px" }}>
          <NavLink to="/dashboard" style={{ textDecoration: "none" }}>
            <Logo size={23} />
          </NavLink>
        </div>

        <RButton variant="primary" full icon={Icons.Reticle} onClick={() => navigate("/record")}>
          New capture
        </RButton>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 18 }}>
          {NAV.map(({ to, label, Icon, count }) => (
            <NavLink key={to} to={to} style={{ textDecoration: "none" }}>
              {({ isActive }) => <NavItem Icon={Icon} label={label} active={isActive} count={count} />}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          {user?.plan === "FREE" && (
            <NavLink
              to="/pricing"
              style={{ textDecoration: "none", display: "block", marginBottom: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  borderRadius: "var(--r)",
                  background: "var(--accent-soft)",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent-ink)",
                  boxShadow: "inset 0 0 0 1px var(--accent-ring)",
                }}
              >
                Upgrade to Pro
                <span
                  className="mono"
                  style={{
                    borderRadius: 99,
                    background: "var(--accent)",
                    padding: "2px 7px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--accent-on)",
                  }}
                >
                  PRO
                </span>
              </div>
            </NavLink>
          )}

          {/* cloud storage meter */}
          <div
            style={{
              padding: 13,
              borderRadius: "var(--r-lg)",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: "oklch(0.62 0.11 145)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                <Icons.Cloud size={13} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Your cloud</span>
              <Ring value={0.36} size={16} sw={2.4} />
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
              Stored in your storage — not ours
            </div>
          </div>

          {/* theme switch */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <ThemeToggle compact />
          </div>

          {/* account row → menu (no more one-click sign-out) */}
          <div style={{ position: "relative" }}>
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 0,
                  right: 0,
                  marginBottom: 6,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                  boxShadow: "var(--e3)",
                  overflow: "hidden",
                  zIndex: 10,
                }}
              >
                {[
                  { label: "Your profile", run: () => navigate("/profile") },
                  { label: "Settings", run: () => navigate("/settings") },
                  { label: "Sign out", run: () => void handleLogout(), danger: true },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMenuOpen(false);
                      item.run();
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "var(--sans)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: item.danger ? "var(--danger)" : "var(--ink-2)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "12px 6px 2px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--sans)",
              }}
              title="Account menu"
            >
              <Avatar name={user?.name ?? user?.email ?? "Account"} hue={210} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.name ?? "Account"}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-4)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.email}
                </div>
              </div>
              <span style={{ color: "var(--ink-4)", transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform var(--t1)", display: "inline-flex" }}>
                <Icons.ChevD size={15} />
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="r-scroll" style={{ height: "100%", flex: 1, overflowY: "auto", background: "var(--paper)" }}>
        {children}
      </main>
    </div>
  );
}

function NavItem({
  Icon,
  label,
  active,
  count,
}: {
  Icon: typeof Icons.Stream;
  label: string;
  active?: boolean;
  count?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        padding: "8px 11px",
        borderRadius: "var(--r)",
        background: active ? "var(--surface)" : hov ? "var(--surface-2)" : "transparent",
        boxShadow: active ? "var(--e1)" : "none",
        color: active ? "var(--ink)" : "var(--ink-2)",
        fontWeight: active ? 600 : 500,
        fontSize: 13.5,
        transition: "all var(--t1)",
        border: active ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <Icon size={18} style={{ color: active ? "var(--accent-ink)" : "var(--ink-3)" }} />
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>
          {count}
        </span>
      )}
    </div>
  );
}
