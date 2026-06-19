/**
 * Profile — account management: display name, email (read-only account key),
 * plan summary, and password change (Google-only accounts may SET a first
 * password — no current password required). Sign-out moved here from the
 * sidebar's old one-click X button.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { Avatar, RButton, Tag } from "../components/recio/index.js";

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    const next = name.trim();
    if (!next || next === user?.name) return;
    setSavingName(true);
    try {
      const { user: updated } = await api.updateMe(next);
      setUser(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1500);
    } catch {
      setName(user?.name ?? "");
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setPwMsg(null);
    if (newPw.length < 8) return setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (newPw !== confirmPw) return setPwMsg({ ok: false, text: "Passwords don't match." });
    setPwBusy(true);
    try {
      await api.changePassword({ currentPassword: currentPw || undefined, newPassword: newPw });
      setPwMsg({ ok: true, text: "Password updated." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof ApiError ? err.message : "Couldn't update the password." });
    } finally {
      setPwBusy(false);
    }
  }

  async function signOut() {
    await logout();
    navigate("/login");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 28px 60px" }}>
      <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>Profile</h1>
      <p style={{ margin: "4px 0 24px", fontSize: 13.5, color: "var(--ink-3)" }}>
        Manage your account. Storage and plan live in{" "}
        <a href="/settings" style={{ color: "var(--accent-ink)", textDecoration: "none", fontWeight: 600 }}>
          Settings
        </a>
        .
      </p>

      {/* identity card */}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={user?.name ?? user?.email ?? "You"} hue={210} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{user?.name ?? "Unnamed"}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{user?.email}</div>
          </div>
          <Tag tone="accent">{user?.plan ?? "FREE"}</Tag>
        </div>

        <label style={label}>
          Display name
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveName()}
              style={input}
              placeholder="Your name"
            />
            <RButton variant={nameSaved ? "primary" : "dark"} size="md" onClick={() => void saveName()} disabled={savingName}>
              {nameSaved ? "Saved" : savingName ? "Saving…" : "Save"}
            </RButton>
          </div>
        </label>

        <label style={label}>
          Email
          <input value={user?.email ?? ""} readOnly disabled style={{ ...input, opacity: 0.6 }} />
        </label>
      </section>

      {/* password card */}
      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={h2}>Password</h2>
        <p style={{ margin: "2px 0 12px", fontSize: 12.5, color: "var(--ink-4)" }}>
          Signed up with Google and never set one? Leave "current password" empty to create your first password.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" style={input} autoComplete="current-password" />
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 8 characters)" style={input} autoComplete="new-password" />
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" style={input} autoComplete="new-password" />
        </div>
        {pwMsg && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: pwMsg.ok ? "var(--success, #22C55E)" : "var(--danger)" }}>{pwMsg.text}</p>
        )}
        <div style={{ marginTop: 12 }}>
          <RButton variant="dark" onClick={() => void changePassword()} disabled={pwBusy || !newPw}>
            {pwBusy ? "Updating…" : "Update password"}
          </RButton>
        </div>
      </section>

      {/* session card */}
      <section style={{ ...card, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={h2}>Session</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-4)" }}>Sign out of Vyooom on this browser.</p>
        </div>
        <RButton variant="outline" onClick={() => void signOut()}>
          Sign out
        </RButton>
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--e1)",
  padding: 18,
};

const h2: React.CSSProperties = { margin: 0, fontSize: 14.5, fontWeight: 700 };

const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 16,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--ink-2)",
};

const input: React.CSSProperties = {
  flex: 1,
  height: 40,
  borderRadius: "var(--r)",
  border: "1px solid var(--line-2)",
  background: "var(--surface-2)",
  padding: "0 12px",
  fontFamily: "var(--sans)",
  fontSize: 13.5,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};
