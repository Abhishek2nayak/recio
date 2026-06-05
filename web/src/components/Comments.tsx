/**
 * Comments thread for a recording/screenshot. Public read; authenticated users post
 * under their account name, guests (on a shared link) provide a name.
 */
import { useEffect, useState } from "react";
import { ResourceType, type CommentDTO } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { Button } from "./ui.js";

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function Comments({ resourceType, resourceId }: { resourceType: ResourceType; resourceId: string }) {
  const authed = useAuthStore((s) => s.status === "authed");
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getComments(resourceId)
      .then((d) => !cancelled && setComments(d.comments))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const { comment } = await api.addComment(
        {
          resourceType,
          resourceId,
          body: body.trim(),
          ...(authed ? {} : { authorName: guestName.trim() || "Guest" }),
        },
        authed,
      );
      setComments((c) => [...c, comment]);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post your comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium">
        Comments {comments.length > 0 && <span className="text-muted">· {comments.length}</span>}
      </h3>

      <div className="mt-3 flex flex-col gap-3">
        {comments.length === 0 && <p className="text-xs text-muted">No comments yet. Start the conversation.</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent">
              {c.authorName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs">
                <span className="font-medium text-text-primary">{c.authorName}</span>{" "}
                <span className="font-mono text-[10px] text-muted">{relTime(c.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-primary">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
        {!authed && (
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            className="rounded-md border border-border bg-bg-secondary px-3 py-2 text-xs outline-none focus:border-accent"
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="resize-none rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
            {posting ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
