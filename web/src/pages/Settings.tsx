import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StorageProvider, formatBytes, type BrandingDTO } from "@flowcap/shared";
import { ApiError, api, type StorageStatus } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { Button, Card, Input, Skeleton, StorageBadge } from "../components/ui.js";

export function Settings() {
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
  const dropboxResult = params.get("dropbox");

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-0.5 text-sm text-muted">Manage where your recordings and screenshots are stored.</p>

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

      <h2 className="mt-8 text-sm font-medium text-muted">Storage connections</h2>
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
                      {drive ? drive.driveEmail ?? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                {drive ? (
                  <Button variant="secondary" size="sm" onClick={disconnectDrive} disabled={busy}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={connectDrive} disabled={busy}>
                    Connect
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
                      {dropbox ? dropbox.driveEmail ?? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                {dropbox ? (
                  <Button variant="secondary" size="sm" onClick={disconnectDropbox} disabled={busy}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={connectDropbox} disabled={busy}>
                    Connect
                  </Button>
                )}
              </div>
            </Card>

            {/* Recio storage */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StorageBadge provider={StorageProvider.FLOWCAP} />
                  <div>
                    <p className="text-sm font-medium">Recio storage</p>
                    <p className="font-mono text-[11px] text-muted">Always available</p>
                  </div>
                </div>
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
              label="Recio"
              active={status.defaultProvider === StorageProvider.FLOWCAP}
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

      <BrandingSection />
    </div>
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
        <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">PRO</span>
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
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
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
        {active ? "Current default" : disabled ? "Connect Drive first" : "Tap to set default"}
      </span>
    </button>
  );
}
