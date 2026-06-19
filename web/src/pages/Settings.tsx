import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StorageProvider, formatBytes, type BrandingDTO } from "@flowcap/shared";
import { ApiError, api, type StorageStatus } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { Button, Card, Input, Skeleton, StorageBadge } from "../components/ui.js";
import { ThemeToggle } from "../components/ThemeToggle.js";

const SECTIONS = [
  { id: "plan", label: "Plan & usage" },
  { id: "storage", label: "Storage" },
  { id: "branding", label: "Branding" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
];

export function Settings() {
  const me = useAuthStore((s) => s.user);
  const hostedStorage = me?.entitlements?.hostedStorage ?? false;
  const navigateTop = useNavigate();
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const driveResult = params.get("drive");

  const load = useCallback(async () => {
    try {
      setStatus(await api.storageStatus(true)); // include the Drive quota bar here
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your storage settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Clear the ?drive= banner param after a moment.
  useEffect(() => {
    if (!driveResult) return;
    const t = setTimeout(() => {
      params.delete("drive");
      setParams(params, { replace: true });
    }, 4000);
    return () => clearTimeout(t);
  }, [driveResult, params, setParams]);

  async function connectDrive() {
    setBusy(true);
    try {
      const { url } = await api.driveConsentUrl();
      window.location.href = url; // full redirect to Google consent
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the Drive connection.");
      setBusy(false);
    }
  }

  async function disconnectDrive() {
    const ok = window.confirm(
      "Disconnect Google Drive?\n\n" +
        "Recordings already saved in your Drive will stop playing — including links you've already shared — until you reconnect this same Google account.\n\n" +
        "Your files stay in your Drive; nothing is deleted.",
    );
    if (!ok) return;
    setBusy(true);
    await api.driveDisconnect().catch(() => {});
    await load();
    setBusy(false);
  }

  async function connectDropbox() {
    setBusy(true);
    try {
      const { url } = await api.dropboxConsentUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the Dropbox connection.");
      setBusy(false);
    }
  }

  async function disconnectDropbox() {
    const ok = window.confirm(
      "Disconnect Dropbox?\n\n" +
        "Recordings already saved in your Dropbox will stop playing — including links you've already shared — until you reconnect this same Dropbox account.\n\n" +
        "Your files stay in your Dropbox; nothing is deleted.",
    );
    if (!ok) return;
    setBusy(true);
    await api.dropboxDisconnect().catch(() => {});
    await load();
    setBusy(false);
  }

  async function setDefault(provider: StorageProvider) {
    setStatus((s) => (s ? { ...s, defaultProvider: provider } : s));
    try {
      await api.setDefaultProvider(provider);
    } catch {
      await load();
    }
  }

  const drive = status?.connections.find((c) => c.provider === StorageProvider.DRIVE && c.isActive);
  const dropbox = status?.connections.find((c) => c.provider === StorageProvider.DROPBOX && c.isActive);
  // Rows that exist but are inactive: the provider revoked/expired our access.
  const driveBroken = status?.connections.find((c) => c.provider === StorageProvider.DRIVE && !c.isActive);
  const dropboxBroken = status?.connections.find((c) => c.provider === StorageProvider.DROPBOX && !c.isActive);
  const dropboxResult = params.get("dropbox");

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-0.5 text-sm text-muted">Your plan, storage, share branding, and account.</p>

      <div className="mt-6 flex items-start gap-8">
        {/* section nav */}
        <nav className="sticky top-6 hidden w-44 shrink-0 flex-col gap-1 md:flex">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-card hover:text-text-primary"
            >
              {sec.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 max-w-3xl flex-1">

      {params.get("billing") === "success" && (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          You're on Pro — thanks! It may take a moment to reflect.
        </div>
      )}

      <section id="plan" style={{ scrollMarginTop: 24 }}>
        <PlanSection />
      </section>

      {driveResult === "connected" && (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Google Drive connected.
        </div>
      )}
      {driveResult === "error" && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Drive connection failed. Please try again.
        </div>
      )}
      {driveResult === "mismatch" && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          That's a different Google account than the one connected. Your existing recordings live in the
          connected account — switching would break them. Reconnect with the same account, or disconnect it
          first to switch.
        </div>
      )}
      {dropboxResult === "mismatch" && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          That's a different Dropbox account than the one connected. Your existing recordings live in the
          connected account — switching would break them. Reconnect with the same account, or disconnect it
          first to switch.
        </div>
      )}
      {(driveBroken || dropboxBroken) && (
        <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {driveBroken ? "Google Drive" : "Dropbox"} lost access (it was revoked or expired). Videos saved
          there won't play or upload — including links you've shared — until you reconnect
          {driveBroken?.driveEmail ? ` ${driveBroken.driveEmail}` : dropboxBroken?.driveEmail ? ` ${dropboxBroken.driveEmail}` : ""}.
        </div>
      )}
      {dropboxResult === "connected" && (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Dropbox connected.
        </div>
      )}
      {dropboxResult === "error" && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Dropbox connection failed. Please try again.
        </div>
      )}

      <h2 id="storage" className="mt-8 text-sm font-medium text-muted" style={{ scrollMarginTop: 24 }}>
        Storage connections
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <>
            {/* Google Drive */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StorageBadge provider={StorageProvider.DRIVE} />
                  <div>
                    <p className="text-sm font-medium">Google Drive</p>
                    <p className="font-mono text-[11px] text-muted">
                      {drive
                        ? drive.driveEmail ?? "Connected"
                        : driveBroken
                          ? `${driveBroken.driveEmail ?? "Connected account"} — access lost, reconnect`
                          : "Not connected"}
                    </p>
                  </div>
                </div>
                {drive ? (
                  <Button variant="secondary" size="sm" onClick={disconnectDrive} disabled={busy}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={connectDrive} disabled={busy}>
                    {driveBroken ? "Reconnect" : "Connect"}
                  </Button>
                )}
              </div>
              {drive && status?.driveQuota && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between font-mono text-[11px] text-muted">
                    <span>{formatBytes(status.driveQuota.used)} used</span>
                    {status.driveQuota.limit && <span>{formatBytes(status.driveQuota.limit)} total</span>}
                  </div>
                  {status.driveQuota.limit && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.min(100, (status.driveQuota.used / status.driveQuota.limit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Dropbox */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StorageBadge provider={StorageProvider.DROPBOX} />
                  <div>
                    <p className="text-sm font-medium">Dropbox</p>
                    <p className="font-mono text-[11px] text-muted">
                      {dropbox
                        ? dropbox.driveEmail ?? "Connected"
                        : dropboxBroken
                          ? `${dropboxBroken.driveEmail ?? "Connected account"} — access lost, reconnect`
                          : "Not connected"}
                    </p>
                  </div>
                </div>
                {dropbox ? (
                  <Button variant="secondary" size="sm" onClick={disconnectDropbox} disabled={busy}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={connectDropbox} disabled={busy}>
                    {dropboxBroken ? "Reconnect" : "Connect"}
                  </Button>
                )}
              </div>
            </Card>

            {/* Vyooom Cloud (Premium destination) */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StorageBadge provider={StorageProvider.FLOWCAP} />
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      Vyooom Cloud
                      {!hostedStorage && (
                        <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-accent-on">
                          PREMIUM
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-muted">
                      {hostedStorage
                        ? "Hosted on Vyooom's servers · included in your plan"
                        : "Hosted on Vyooom's servers — connect Drive or Dropbox above to record free"}
                    </p>
                  </div>
                </div>
                {!hostedStorage && (
                  <Button variant="highlight" size="sm" onClick={() => navigateTop("/pricing")}>
                    Upgrade
                  </Button>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Default destination */}
      {status && (
        <>
          <h2 className="mt-8 text-sm font-medium text-muted">Default destination for new captures</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <DefaultChip
              label="Vyooom Cloud"
              active={status.defaultProvider === StorageProvider.FLOWCAP}
              disabled={!hostedStorage}
              hint={!hostedStorage ? "Premium plan required" : undefined}
              onClick={() => setDefault(StorageProvider.FLOWCAP)}
            />
            <DefaultChip
              label="Google Drive"
              active={status.defaultProvider === StorageProvider.DRIVE}
              disabled={!drive}
              onClick={() => setDefault(StorageProvider.DRIVE)}
            />
            <DefaultChip
              label="Dropbox"
              active={status.defaultProvider === StorageProvider.DROPBOX}
              disabled={!dropbox}
              onClick={() => setDefault(StorageProvider.DROPBOX)}
            />
          </div>
        </>
      )}

      <section id="branding" style={{ scrollMarginTop: 24 }}>
        <BrandingSection />
      </section>

      {/* appearance */}
      <h2 id="appearance" className="mt-8 text-sm font-medium text-muted" style={{ scrollMarginTop: 24 }}>
        Appearance
      </h2>
      <Card className="mt-3 flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-medium">Theme</p>
          <p className="mt-0.5 text-xs text-muted">Light, dark, or match your system setting.</p>
        </div>
        <ThemeToggle />
      </Card>

      {/* account */}
      <h2 id="account" className="mt-8 text-sm font-medium text-muted" style={{ scrollMarginTop: 24 }}>
        Account
      </h2>
      <Card className="mt-3 flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">Profile & security</p>
          <p className="mt-0.5 text-xs text-muted">Display name, password, and sign-out live on your profile.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigateTop("/profile")}>
          Open profile
        </Button>
      </Card>
        </div>
      </div>
    </div>
  );
}

function formatGb(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(bytes >= 1024 ** 3 ? 1 : 2)} GB`;
}

/** Current plan + a link to plans (free) or the Stripe billing portal (paid). */
function PlanSection() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<import("@flowcap/shared").StreamUsageDTO | null>(null);
  const plan = user?.plan ?? "FREE";
  const isPaid = plan !== "FREE";

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {});
  }, []);

  async function manage() {
    setBusy(true);
    try {
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch {
      navigate("/pricing");
    }
  }

  const pct = usage && usage.cap ? Math.min(100, Math.round((usage.used / usage.cap) * 100)) : 0;

  return (
    <>
    <Card className="mt-6 flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">Plan</span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (isPaid ? "bg-highlight text-accent-on" : "bg-bg-primary text-muted ring-1 ring-border")
          }
        >
          {plan}
        </span>
      </div>
      {isPaid ? (
        <Button variant="secondary" size="sm" onClick={manage} disabled={busy}>
          Manage billing
        </Button>
      ) : (
        <Button variant="highlight" size="sm" onClick={() => navigate("/pricing")}>
          Upgrade
        </Button>
      )}
    </Card>

    {usage && usage.cap != null && (
      <Card className="mt-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">Streaming this month</span>
          <span className="font-mono text-xs text-muted">
            {formatGb(usage.used)} / {formatGb(usage.cap)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-primary ring-1 ring-border">
          <div
            className={"h-full rounded-full " + (pct >= 90 ? "bg-danger" : "bg-highlight")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          Bandwidth for shared playback. {isPaid ? "" : "Upgrade for more headroom."}
        </p>
      </Card>
    )}
    </>
  );
}

/** Pro custom-branding editor for share pages. Locked (with an upgrade nudge) on Free. */
function BrandingSection() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isPro = Boolean(user?.entitlements?.customBranding);
  const [b, setB] = useState<BrandingDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getBranding()
      .then(setB)
      .catch(() => setB({ brandName: null, brandLogoUrl: null, ctaLabel: null, ctaUrl: null }));
  }, []);

  function field(key: keyof BrandingDTO, value: string) {
    setB((p) => ({ ...(p as BrandingDTO), [key]: value.trim() || null }));
    setSaved(false);
  }
  async function save() {
    if (!b) return;
    setSaving(true);
    try {
      setB(await api.updateBranding(b));
      setSaved(true);
    } catch {
      /* surfaced by the global 402 modal if it's an entitlement issue */
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="mt-8 flex items-center gap-2 text-sm font-medium text-muted">
        Share page branding
        <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-accent-on">PRO</span>
      </h2>
      <Card className="mt-3 p-4">
        {!isPro && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-highlight/15 px-3 py-2 ring-1 ring-highlight/40">
            <p className="text-xs text-text-primary">Add your logo and a call-to-action to share pages with Pro.</p>
            <Button variant="highlight" size="sm" onClick={() => navigate("/pricing")}>
              Upgrade
            </Button>
          </div>
        )}
        <fieldset disabled={!isPro || !b} className={!isPro ? "opacity-60" : ""}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Brand name">
              <Input value={b?.brandName ?? ""} onChange={(e) => field("brandName", e.target.value)} placeholder="Acme Inc." />
            </Labeled>
            <Labeled label="Logo URL">
              <Input value={b?.brandLogoUrl ?? ""} onChange={(e) => field("brandLogoUrl", e.target.value)} placeholder="https://…/logo.png" />
            </Labeled>
            <Labeled label="Call-to-action label">
              <Input value={b?.ctaLabel ?? ""} onChange={(e) => field("ctaLabel", e.target.value)} placeholder="Book a call" />
            </Labeled>
            <Labeled label="Call-to-action link">
              <Input value={b?.ctaUrl ?? ""} onChange={(e) => field("ctaUrl", e.target.value)} placeholder="https://cal.com/you" />
            </Labeled>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save branding"}
            </Button>
            {saved && <span className="text-xs text-success">Saved</span>}
          </div>
        </fieldset>
      </Card>
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function DefaultChip({
  label,
  active,
  disabled,
  hint,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-lg border px-4 py-3 text-left text-sm transition-colors " +
        (active
          ? "border-accent bg-accent/10 text-text-primary"
          : "border-border bg-card text-muted hover:border-muted") +
        (disabled ? " cursor-not-allowed opacity-50" : "")
      }
    >
      <span className="font-medium">{label}</span>
      <span className="mt-0.5 block text-[11px] text-muted">
        {active ? "Current default" : disabled ? hint ?? "Connect it first" : "Tap to set default"}
      </span>
    </button>
  );
}
