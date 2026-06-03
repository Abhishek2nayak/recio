/**
 * Loom-style media detail page for recordings + screenshots: large player, prominent
 * inline-editable title, owner + meta row, an emoji reactions bar, and a right rail
 * with the Share panel (server-side Drive permission toggle), a Transcript placeholder,
 * and delete. The page wrappers only handle fetching + the type-specific API calls.
 */
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link, useNavigate } from "react-router-dom";
import { ResourceType, formatBytes, formatDuration, type MediaDTO } from "@flowcap/shared";
import { useAuthStore } from "../stores/authStore.js";
import { MediaPlayer } from "./MediaPlayer.js";
import { SharePanel } from "./SharePanel.js";
import { Reactions } from "./Reactions.js";
import { Button, StorageBadge } from "./ui.js";
import { TrashIcon } from "./icons.js";

export function MediaDetail({
  media,
  playbackUrl,
  onRename,
  onDelete,
}: {
  media: MediaDTO;
  playbackUrl: string;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState(media.title);
  const [editing, setEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(media.isPublic);
  const [deleting, setDeleting] = useState(false);
  const isRecording = media.resourceType === ResourceType.RECORDING;

  async function commitTitle() {
    setEditing(false);
    const next = title.trim();
    if (next && next !== media.title) await onRename(next);
    else setTitle(media.title);
  }

  async function confirmDelete() {
    setDeleting(true);
    await onDelete();
    navigate("/dashboard");
  }

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-6 py-5">
      <Link to="/dashboard" className="text-sm text-muted hover:text-text-primary">
        ← Library
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Editable title */}
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === "Enter" && commitTitle()}
              className="w-full rounded-md border border-accent bg-bg-secondary px-2.5 py-1.5 text-xl font-semibold outline-none"
            />
          ) : (
            <h1
              onClick={() => setEditing(true)}
              className="group flex cursor-text items-center gap-2 rounded-md px-1 text-xl font-semibold tracking-tight"
              title="Click to rename"
            >
              {title}
              <PencilHint />
            </h1>
          )}

          <MediaPlayer media={media} playbackUrl={playbackUrl} />

          {/* Owner + meta + reactions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-medium text-accent">
                {initial}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium">{user?.name ?? "You"}</p>
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  {media.viewCount} views · {formatBytes(media.size)}
                  {isRecording && media.duration > 0 ? ` · ${formatDuration(media.duration)}` : ""}
                  <span>·</span> {new Date(media.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Reactions resourceType={media.resourceType} resourceId={media.id} />
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          <SharePanel
            shareToken={media.shareToken}
            isPublic={isPublic}
            provider={media.storageProvider}
            onChange={setIsPublic}
          />

          {/* Transcript placeholder (Loom parity; AI transcript is a Phase-2 feature) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Transcript</h3>
              <span className="rounded-full bg-bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted">
                soon
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Automatic transcripts and AI summaries are coming to FlowCap recordings.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <span className="flex items-center gap-2 text-xs text-muted">
              Stored in <StorageBadge provider={media.storageProvider} />
            </span>
            <DeleteDialog deleting={deleting} onConfirm={confirmDelete} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PencilHint() {
  return (
    <svg
      className="opacity-0 transition-opacity group-hover:opacity-60"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function DeleteDialog({ deleting, onConfirm }: { deleting: boolean; onConfirm: () => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="danger" size="sm">
          <TrashIcon width={15} height={15} />
          Delete
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-base font-semibold">Delete this item?</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted">
            This removes it from your library and deletes the file from your storage. This can't be undone.
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={onConfirm} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
