/**
 * Share menu — send a recording link the way Loom does: straight to Slack or Discord
 * (via an incoming webhook the user pastes once, kept in localStorage and relayed by
 * the server), plus one-tap social/email intents and the native share sheet.
 */
import { useState } from "react";
import { api, ApiError } from "../lib/api.js";

const WEBHOOK_KEY = (p: "slack" | "discord") => `vyooom.webhook.${p}`;

function brandIcon(p: string) {
  const s = { width: 18, height: 18, display: "block" } as const;
  switch (p) {
    case "slack":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M5.1 14.9a2 2 0 1 1-2-2h2zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0zM9.1 5a2 2 0 1 1 2 2h-2zm0 1a2 2 0 1 1 0 4h-5a2 2 0 1 1 0-4zM19 9.1a2 2 0 1 1 2 2h-2zm-1 0a2 2 0 1 1-4 0v-5a2 2 0 1 1 4 0zM14.9 19a2 2 0 1 1-2-2h2zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4z"/></svg>
      );
    case "discord":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M19.5 5.5A16 16 0 0 0 15.5 4l-.3.5a13 13 0 0 1 3.5 1.8 13.7 13.7 0 0 0-11.5 0A13 13 0 0 1 10.8 4.5L10.5 4a16 16 0 0 0-4 1.5C3.6 9.6 3 13.6 3.3 17.5a16 16 0 0 0 4.9 2.5l.6-1a11 11 0 0 1-1.7-.8l.4-.3a11 11 0 0 0 9.4 0l.4.3a11 11 0 0 1-1.7.8l.6 1a16 16 0 0 0 4.9-2.5c.4-4.6-.6-8.6-2.6-12zM9.5 15c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm5 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z"/></svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M18.2 2h3.3l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2l7.7-8.8L1.5 2h6.8l4.7 6.2zm-1.2 18h1.8L7.1 3.9H5.2z"/></svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M6.5 8.5v10h-3v-10zM5 3.5A1.8 1.8 0 1 1 5 7a1.8 1.8 0 0 1 0-3.5zM9 8.5h2.9v1.4c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.1 3.9 4.9v5.4h-3v-4.8c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5v4.9H9z"/></svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 6.8 12.2l.4.6-.7 2.6-2.7-.7-.6-.3A8 8 0 1 1 12 4zm-3 4.2c-.2 0-.5 0-.7.4-.2.4-.9 1-.9 2.3s1 2.7 1.1 2.9c.1.2 1.9 3 4.7 4.1 2.3.9 2.8.7 3.3.7s1.6-.7 1.9-1.3c.2-.6.2-1.2.2-1.3l-.6-.3-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.5.1s-1-.4-1.9-1.2c-.7-.6-1.2-1.4-1.3-1.6s0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4z"/></svg>
      );
    case "more":
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 14.5V4M8.5 7.5 12 4l3.5 3.5"/><path d="M5.5 12.5v5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5"/></svg>
      );
    default:
      return null;
  }
}

const COLORS: Record<string, string> = {
  slack: "#4A154B",
  discord: "#5865F2",
  email: "#5b6470",
  x: "#0a0a0a",
  linkedin: "#0A66C2",
  whatsapp: "#25D366",
  more: "#5b6470",
};

export function ShareMenu({ url, title }: { url: string; title: string }) {
  const [hook, setHook] = useState<null | "slack" | "discord">(null);
  const [webhook, setWebhook] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const text = `${title} — ${url}`;
  const intents: Record<string, string> = {
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
  };

  function openHook(p: "slack" | "discord") {
    setError(null);
    setDone(null);
    if (hook === p) {
      setHook(null);
      return;
    }
    setHook(p);
    setWebhook(localStorage.getItem(WEBHOOK_KEY(p)) ?? "");
  }

  async function send() {
    if (!hook) return;
    const w = webhook.trim();
    if (!w) {
      setError("Paste your webhook URL.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.notifyShare({ provider: hook, webhookUrl: w, title, url });
      localStorage.setItem(WEBHOOK_KEY(hook), w);
      setDone(hook);
      setHook(null);
      setTimeout(() => setDone(null), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send. Check the webhook URL.");
    } finally {
      setSending(false);
    }
  }

  function nativeShare() {
    if (navigator.share) void navigator.share({ title, url }).catch(() => {});
    else void navigator.clipboard.writeText(url);
  }

  const Btn = ({ id, label, onClick }: { id: string; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1px solid var(--line-2)",
        background: "var(--surface-2)",
        color: COLORS[id] ?? "var(--ink-2)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {brandIcon(id)}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Btn id="slack" label="Send to Slack" onClick={() => openHook("slack")} />
        <Btn id="discord" label="Send to Discord" onClick={() => openHook("discord")} />
        <a href={intents.email} style={{ textDecoration: "none" }}><Btn id="email" label="Email" onClick={() => {}} /></a>
        <a href={intents.x} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn id="x" label="Share on X" onClick={() => {}} /></a>
        <a href={intents.linkedin} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn id="linkedin" label="Share on LinkedIn" onClick={() => {}} /></a>
        <a href={intents.whatsapp} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn id="whatsapp" label="Share on WhatsApp" onClick={() => {}} /></a>
        <Btn id="more" label="More…" onClick={nativeShare} />
      </div>

      {hook && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
            Paste your {hook === "slack" ? "Slack" : "Discord"} incoming-webhook URL — it's saved on this device only.
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder={hook === "slack" ? "https://hooks.slack.com/services/…" : "https://discord.com/api/webhooks/…"}
              style={{
                flex: 1,
                minWidth: 0,
                height: 38,
                borderRadius: "var(--r)",
                border: "1px solid var(--line-2)",
                background: "var(--surface-2)",
                padding: "0 12px",
                fontSize: 12,
                color: "var(--ink-2)",
                outline: "none",
              }}
            />
            <button
              onClick={() => void send()}
              disabled={sending}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: "var(--r)",
                border: "none",
                background: "var(--accent)",
                color: "var(--accent-ink)",
                fontWeight: 700,
                fontSize: 13,
                cursor: sending ? "default" : "pointer",
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
      {done && <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent-ink)" }}>Sent to {done === "slack" ? "Slack" : "Discord"} ✓</div>}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}
