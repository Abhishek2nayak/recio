/**
 * Comments thread for a recording/screenshot. Public read; authenticated users post
 * under their account name, guests (on a shared link) provide a name.
 *
 * Supports: timestamped comments (anchored to the current playback position, with a
 * clickable chip that seeks the player), @mentions of workspace members (picker +
 * highlight), and image/file attachments (rendered inline).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ResourceType, type CommentDTO } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { Avatar, RButton, Tag } from "./recio/index.js";
import { Icons } from "./recio/icons.js";
import { uploadCommentAttachment } from "../lib/attachments.js";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const ATTACH_RE = /\[\[attach:([^\]]+)\]\]/g;
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i;

/** Split a comment body into mention/attachment-aware fragments for rendering. */
function renderBody(body: string, onSeek?: (s: number) => void) {
  const attachments: string[] = [];
  const text = body.replace(ATTACH_RE, (_m, url) => {
    attachments.push(url);
    return "";
  }).trim();

  // highlight @mentions and (mm:ss) timecodes
  const parts = text.split(/(@[\p{L}][\p{L}0-9_]*|\b\d{1,2}:\d{2}\b)/u);
  return (
    <>
      {text && (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {parts.map((p, i) => {
            if (/^@/.test(p))
              return (
                <span key={i} style={{ color: "var(--accent-ink)", fontWeight: 600 }}>
                  {p}
                </span>
              );
            if (/^\d{1,2}:\d{2}$/.test(p) && onSeek)
              return (
                <button
                  key={i}
                  onClick={() => {
                    const [m, s] = p.split(":").map(Number);
                    onSeek((m ?? 0) * 60 + (s ?? 0));
                  }}
                  className="mono"
                  style={{ border: "none", background: "transparent", color: "var(--accent-ink)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  {p}
                </button>
              );
            return <span key={i}>{p}</span>;
          })}
        </p>
      )}
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: text ? 8 : 0 }}>
          {attachments.map((url, i) =>
            IMG_RE.test(url) ? (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="attachment" style={{ maxHeight: 140, maxWidth: 220, borderRadius: "var(--r)", border: "1px solid var(--line)", display: "block" }} />
              </a>
            ) : (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--accent-ink)", textDecoration: "none", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "6px 10px", background: "var(--surface-2)" }}
              >
                <Icons.Download size={14} /> Attachment {i + 1}
              </a>
            ),
          )}
        </div>
      )}
    </>
  );
}

export function Comments({
  resourceType,
  resourceId,
  currentTime,
  onSeek,
}: {
  resourceType: ResourceType;
  resourceId: string;
  currentTime?: () => number;
  onSeek?: (sec: number) => void;
}) {
  const authed = useAuthStore((s) => s.status === "authed");
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atTime, setAtTime] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getComments(resourceId).then((d) => !cancelled && setComments(d.comments)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  // Mentionable people = members of the caller's first workspace.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    void api
      .listWorkspaces()
      .then((r) => (r.workspaces[0] ? api.workspaceMembers(r.workspaces[0].id) : { members: [] }))
      .then((r) => !cancelled && setMembers(r.members.map((m) => m.name || m.email.split("@")[0] || "User")))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => m.toLowerCase().includes(q)).slice(0, 5);
  }, [mention, members]);

  function onBodyChange(value: string) {
    setBody(value);
    const caret = taRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = /(^|\s)@([\p{L}0-9_]*)$/u.exec(before);
    const q = m?.[2] ?? "";
    setMention(m ? { query: q, at: caret - q.length - 1 } : null);
  }

  function pickMention(name: string) {
    if (!mention) return;
    const safe = name.replace(/\s+/g, "");
    const next = body.slice(0, mention.at) + "@" + safe + " " + body.slice((taRef.current?.selectionStart ?? mention.at) );
    setBody(next);
    setMention(null);
    taRef.current?.focus();
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadCommentAttachment(file);
      setAttachments((a) => [...a, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't attach that file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function post() {
    const trimmed = body.trim();
    if (!trimmed && attachments.length === 0) return;
    setPosting(true);
    setError(null);
    const ts = atTime != null ? ` ${fmt(atTime)}` : "";
    const attachMarkup = attachments.map((u) => `[[attach:${u}]]`).join(" ");
    const fullBody = `${trimmed}${ts ? ` (${fmt(atTime!)})` : ""} ${attachMarkup}`.trim();
    try {
      const { comment } = await api.addComment(
        {
          resourceType,
          resourceId,
          body: fullBody,
          ...(atTime != null ? { timestampSec: Math.round(atTime) } : {}),
          ...(authed ? {} : { authorName: guestName.trim() || "Guest" }),
        },
        authed,
      );
      setComments((c) => [...c, comment]);
      setBody("");
      setAttachments([]);
      setAtTime(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post your comment.");
    } finally {
      setPosting(false);
    }
  }

  const canTimestamp = typeof currentTime === "function";

  return (
    <div style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--line)", background: "var(--surface)", padding: 16, boxShadow: "var(--e1)" }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
        Comments {comments.length > 0 && <span style={{ color: "var(--ink-4)", fontWeight: 600 }}>· {comments.length}</span>}
      </h3>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
        {comments.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--ink-4)" }}>No comments yet. Start the conversation.</p>}
        {comments.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 12 }}>
            <Avatar name={c.authorName} hue={(c.authorName.charCodeAt(0) * 37) % 360} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13.5 }}>{c.authorName}</b>
                {c.timestampSec != null && onSeek && (
                  <button onClick={() => onSeek(c.timestampSec!)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }} title="Jump to this moment">
                    <Tag tone="accent" style={{ height: 18, fontSize: 10 }}>{fmt(c.timestampSec)}</Tag>
                  </button>
                )}
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{relTime(c.createdAt)}</span>
              </div>
              {renderBody(c.body, onSeek)}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {!authed && (
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            style={{ height: 36, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface)", padding: "0 12px", fontSize: 13, outline: "none", fontFamily: "var(--sans)" }}
          />
        )}
        <div style={{ position: "relative" }}>
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder={canTimestamp ? "Add a comment… use @ to mention" : "Add a comment…"}
            rows={2}
            style={{ width: "100%", resize: "none", borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface)", padding: "10px 12px", fontSize: 13.5, outline: "none", fontFamily: "var(--sans)", color: "var(--ink)" }}
          />
          {mention && mentionMatches.length > 0 && (
            <div style={{ position: "absolute", left: 8, bottom: "100%", marginBottom: 4, zIndex: 10, minWidth: 180, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", boxShadow: "var(--e3)", padding: 4 }}>
              {mentionMatches.map((m) => (
                <button
                  key={m}
                  onClick={() => pickMention(m)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", border: "none", background: "transparent", borderRadius: "var(--r-sm)", cursor: "pointer", textAlign: "left", fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Avatar name={m} hue={(m.charCodeAt(0) * 37) % 360} size={22} /> {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* attachment chips */}
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attachments.map((u, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "4px 8px" }}>
                <Icons.Check size={12} style={{ color: "var(--accent-ink)" }} /> Attachment {i + 1}
                <button onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", padding: 0, display: "inline-flex" }}>
                  <Icons.X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{error}</p>}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canTimestamp && (
            <button
              onClick={() => setAtTime((t) => (t == null ? Math.max(0, Math.round(currentTime!())) : null))}
              title="Anchor to the current time"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 10px",
                borderRadius: "var(--r-pill)",
                border: "1px solid",
                borderColor: atTime != null ? "transparent" : "var(--line)",
                background: atTime != null ? "var(--accent-soft)" : "var(--surface)",
                color: atTime != null ? "var(--accent-ink)" : "var(--ink-3)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--sans)",
              }}
            >
              <Icons.Clock size={14} /> {atTime != null ? `At ${fmt(atTime)}` : "At current time"}
            </button>
          )}
          <input ref={fileRef} type="file" hidden onChange={(e) => void onPickFile(e.target.files?.[0])} />
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach a file"
            disabled={uploading}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" }}
          >
            <Icons.Plus size={14} /> {uploading ? "Uploading…" : "Attach"}
          </button>
          <div style={{ marginLeft: "auto" }}>
            <RButton variant="primary" size="sm" onClick={post} disabled={posting || (!body.trim() && attachments.length === 0)}>
              {posting ? "Posting…" : "Comment"}
            </RButton>
          </div>
        </div>
      </div>
    </div>
  );
}
