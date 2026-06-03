/**
 * Emoji reaction bar, backed by the public `/reactions` endpoints. Loads aggregate
 * counts and posts a reaction (optimistically) — anyone viewing a shared item can react.
 */
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { REACTION_EMOJIS, ResourceType, type ReactionCounts } from "@flowcap/shared";
import { api } from "../lib/api.js";

export function Reactions({ resourceType, resourceId }: { resourceType: ResourceType; resourceId: string }) {
  const [counts, setCounts] = useState<ReactionCounts>({});
  const [bump, setBump] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getReactions(resourceId)
      .then((d) => !cancelled && setCounts(d.counts))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  async function react(emoji: string) {
    setCounts((c) => ({ ...c, [emoji]: (c[emoji] ?? 0) + 1 })); // optimistic
    setBump(emoji);
    setTimeout(() => setBump((b) => (b === emoji ? null : b)), 250);
    try {
      const d = await api.react({ resourceType, resourceId, emoji: emoji as never });
      setCounts(d.counts); // reconcile with server truth
    } catch {
      /* keep optimistic value */
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5">
      {REACTION_EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => react(e)}
          className={clsx(
            "flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-transform hover:bg-bg-secondary",
            bump === e && "scale-125",
          )}
        >
          <span>{e}</span>
          {counts[e] ? <span className="font-mono text-[11px] text-muted">{counts[e]}</span> : null}
        </button>
      ))}
    </div>
  );
}
