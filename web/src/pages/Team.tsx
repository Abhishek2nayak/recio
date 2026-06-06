/**
 * Team workspaces (Business): create a workspace, invite members by link, manage
 * roles, and browse the shared team library. Gated by the `team` entitlement — free
 * users get an upgrade nudge.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InviteDTO, MediaDTO, MemberDTO, RecordingDTO, ScreenshotDTO, WorkspaceDTO } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { MediaCard } from "../components/MediaCard.js";
import { Button, Card, EmptyState, Input, Spinner } from "../components/ui.js";
import { LibraryIcon } from "../components/icons.js";

export function Team() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const canTeam = Boolean(user?.entitlements?.team);

  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    const { workspaces: ws } = await api.listWorkspaces();
    setWorkspaces(ws);
    setActiveId((cur) => cur ?? ws[0]?.id ?? null);
  }, []);

  useEffect(() => {
    loadWorkspaces().catch(() => setWorkspaces([]));
  }, [loadWorkspaces]);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { workspace } = await api.createWorkspace(newName.trim());
      setNewName("");
      await loadWorkspaces();
      setActiveId(workspace.id);
    } finally {
      setBusy(false);
    }
  }

  if (workspaces === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-muted" />
      </div>
    );
  }

  const active = workspaces.find((w) => w.id === activeId) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Team</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Workspaces</h1>
        </div>
        {workspaces.length > 1 && (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-accent"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {workspaces.length === 0 ? (
        <Card className="mt-6 p-6">
          {canTeam ? (
            <div className="max-w-md">
              <h2 className="text-base font-semibold">Create your team workspace</h2>
              <p className="mt-1 text-sm text-muted">Invite teammates and share a recording library.</p>
              <div className="mt-4 flex gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Marketing" />
                <Button onClick={create} disabled={busy || !newName.trim()}>
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Team workspaces are a Business feature</h2>
                <p className="mt-1 text-sm text-muted">Shared library, members & roles, SSO.</p>
              </div>
              <Button variant="highlight" onClick={() => navigate("/pricing")}>
                Upgrade
              </Button>
            </div>
          )}
        </Card>
      ) : (
        active && <WorkspacePanel key={active.id} workspace={active} onChanged={loadWorkspaces} />
      )}
    </div>
  );
}

function WorkspacePanel({ workspace, onChanged }: { workspace: WorkspaceDTO; onChanged: () => Promise<void> }) {
  const isManager = workspace.role === "OWNER" || workspace.role === "ADMIN";
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [invites, setInvites] = useState<InviteDTO[]>([]);
  const [media, setMedia] = useState<MediaDTO[] | null>(null);
  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    const [{ members: m }, recs, shots] = await Promise.all([
      api.workspaceMembers(workspace.id),
      api.listRecordings({ workspaceId: workspace.id, limit: 50 }),
      api.listScreenshots({ workspaceId: workspace.id, limit: 50 }),
    ]);
    setMembers(m);
    setMedia(
      [...(recs.items as RecordingDTO[]), ...(shots.items as ScreenshotDTO[])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
    if (isManager) setInvites((await api.workspaceInvites(workspace.id)).invites);
  }, [workspace.id, isManager]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function linkFor(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function invite() {
    if (!email.trim()) return;
    const { invite: inv } = await api.inviteMember(workspace.id, email.trim(), "MEMBER");
    setEmail("");
    setLastLink(linkFor(inv.token));
    await reload();
  }
  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Shared library */}
      <div>
        <h2 className="text-sm font-medium text-muted">Shared library</h2>
        {media === null ? (
          <div className="mt-3 flex justify-center py-10">
            <Spinner className="text-muted" />
          </div>
        ) : media.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<LibraryIcon width={26} height={26} />}
              title="No team videos yet"
              description="Move a recording into this workspace from its page to share it with the team."
            />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {media.map((m) => (
              <MediaCard key={`${m.resourceType}-${m.id}`} media={m} />
            ))}
          </div>
        )}
      </div>

      {/* Members + invites */}
      <div className="flex flex-col gap-4">
        {isManager && (
          <Card className="p-4">
            <h3 className="text-sm font-medium">Invite a teammate</h3>
            <div className="mt-2 flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@acme.com" />
              <Button size="sm" onClick={invite} disabled={!email.trim()}>
                Invite
              </Button>
            </div>
            {lastLink && (
              <div className="mt-3">
                <p className="text-[11px] text-muted">Share this invite link:</p>
                <div className="mt-1 flex gap-2">
                  <input
                    readOnly
                    value={lastLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-md border border-border bg-bg-secondary px-2 py-1.5 font-mono text-[11px] outline-none"
                  />
                  <Button variant="secondary" size="sm" onClick={() => void copyLink(lastLink)}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
            {invites.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] text-muted">Pending</p>
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-text-primary">{inv.email}</span>
                    <span className="flex items-center gap-2">
                      <button onClick={() => void copyLink(linkFor(inv.token))} className="text-accent hover:text-accent-hover">
                        link
                      </button>
                      <button
                        onClick={() => void api.revokeInvite(workspace.id, inv.id).then(reload)}
                        className="text-muted hover:text-danger"
                      >
                        revoke
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card className="p-4">
          <h3 className="text-sm font-medium">Members · {members.length}</h3>
          <div className="mt-2 space-y-2">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{m.name ?? m.email}</p>
                  <p className="truncate text-[11px] text-muted">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-bg-primary px-2 py-0.5 text-[10px] font-medium text-muted ring-1 ring-border">
                    {m.role}
                  </span>
                  {isManager && m.role !== "OWNER" && (
                    <button
                      onClick={() => void api.removeMember(workspace.id, m.userId).then(reload).then(onChanged)}
                      className="text-[11px] text-muted hover:text-danger"
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
