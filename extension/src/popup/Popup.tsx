/**
 * Toolbar popup — the capture launcher. Choose a mode, set mic/camera/quality and
 * destination, then Record / Screenshot. Rendered in the Vyooom design system
 * (cyan accent, capture-reticle, Hanken Grotesk).
 */
import { useCallback, useEffect, useState } from "react";
import { StorageProvider } from "@flowcap/shared";
import { api } from "../lib/api.js";
import { sendMessage, type UploadState } from "../lib/messages.js";
import { deletePending, listPending, type PendingUpload } from "../lib/pendingUploads.js";
import { listDevices, type Devices } from "../lib/devices.js";
import { config } from "../config.js";
import {
  getSession,
  getSettings,
  setSession,
  setSettings,
  type RecordingQuality,
  type Session,
  type ThemeMode,
} from "../lib/storage.js";
import { applyTheme, initTheme, nextThemeMode } from "../lib/theme.js";
import { AuthForm } from "./AuthForm.js";
import { ProgressBar, StorageBadge } from "../components/ui.js";
import { Icons, Logo, RButton, Toggle, Waveform, type IconComponent } from "../components/recio/index.js";

const QUALITIES: RecordingQuality[] = ["high", "standard", "saver"];

export function Popup() {
  const [loading, setLoading] = useState(true);
  const [session, setSess] = useState<Session | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [driveBroken, setDriveBroken] = useState(false);
  const [dropboxBroken, setDropboxBroken] = useState(false);
  const [destination, setDestination] = useState<StorageProvider>(StorageProvider.FLOWCAP);
  const [connecting, setConnecting] = useState<null | "drive" | "dropbox">(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);

  // capture settings
  const [camera, setCamera] = useState(false);
  const [microphone, setMicrophone] = useState(true);
  const [quality, setQuality] = useState<RecordingQuality>("standard");
  const [countdown, setCountdown] = useState(true);
  const [micDeviceId, setMicDeviceId] = useState("");
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [devices, setDevices] = useState<Devices>({ mics: [], cameras: [] });
  const [advanced, setAdvanced] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("system");

  // Apply the saved light/dark mode as early as possible (independent of session).
  useEffect(() => {
    void initTheme().then(setTheme);
  }, []);

  const cycleTheme = async () => {
    const next = nextThemeMode(theme);
    setTheme(next);
    applyTheme(next);
    await setSettings({ theme: next });
  };

  const hostedStorage = session?.user.entitlements?.hostedStorage ?? false;

  const refreshStatus = useCallback(async () => {
    try {
      const status = await api.storageStatus();
      setDriveConnected(status.connections.some((c) => c.provider === StorageProvider.DRIVE && c.isActive));
      setDropboxConnected(status.connections.some((c) => c.provider === StorageProvider.DROPBOX && c.isActive));
      // A row that exists but is inactive means the provider revoked/expired our
      // access — surface "reconnect" (videos there won't play or upload until then).
      setDriveBroken(status.connections.some((c) => c.provider === StorageProvider.DRIVE && !c.isActive));
      setDropboxBroken(status.connections.some((c) => c.provider === StorageProvider.DROPBOX && !c.isActive));
      setDestination(status.defaultProvider);
      setStatusError(null);
    } catch {
      setStatusError("Couldn't reach the Vyooom server.");
      setDestination((await getSettings()).destination);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await getSession();
      setSess(s);
      if (s) await refreshStatus();
      const settings = await getSettings();
      setCamera(settings.camera);
      setMicrophone(settings.microphone);
      setQuality(settings.quality);
      setCountdown(settings.countdown);
      setMicDeviceId(settings.micDeviceId);
      setCameraDeviceId(settings.cameraDeviceId);
      setDevices(await listDevices());
      setLoading(false);
    })();
  }, [refreshStatus]);

  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      const res = await sendMessage({ type: "GET_UPLOADS" });
      if (res.ok && res.uploads) setUploads(res.uploads);
      // Leftover captures whose upload never finished (failure, crash, sleep).
      // Hide ones that are mid-upload right now — those show in Uploads above.
      const uploading = new Set((res.ok && res.uploads ? res.uploads : []).filter((u) => u.status === "uploading").map((u) => u.id));
      setPending((await listPending().catch(() => [] as PendingUpload[])).filter((p) => !uploading.has(p.id)));
    };
    void poll();
    const t = setInterval(poll, 1000);
    return () => clearInterval(t);
  }, [session]);

  function recoverPending(id: string) {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`src/studio/index.html?recover=${id}`) });
    window.close();
  }

  async function discardPending(id: string) {
    if (!window.confirm("Delete this unsaved recording permanently? It hasn't been uploaded anywhere.")) return;
    await deletePending(id);
    setPending((items) => items.filter((p) => p.id !== id));
  }

  async function record() {
    // Loom-style: show the on-page recorder panel on the active tab (falls back to the
    // studio tab for pages we can't inject into, e.g. chrome:// or the web store).
    await sendMessage({ type: "SHOW_LAUNCHER" });
    window.close();
  }
  async function screenshot() {
    await sendMessage({ type: "CAPTURE_SCREENSHOT" });
    window.close();
  }
  async function whiteboard() {
    await sendMessage({ type: "OPEN_STUDIO", mode: "whiteboard" });
    window.close();
  }

  async function connect(which: "drive" | "dropbox") {
    setConnecting(which);
    try {
      const res = await sendMessage({ type: which === "drive" ? "CONNECT_DRIVE" : "CONNECT_DROPBOX" });
      if (!res.ok) throw new Error(res.error);
      await refreshStatus();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setConnecting(null);
    }
  }

  async function chooseDestination(provider: StorageProvider) {
    setDestination(provider);
    await setSettings({ destination: provider });
    try {
      await api.setDefaultProvider(provider);
    } catch {
      /* best-effort */
    }
  }

  async function patch(patchObj: Parameters<typeof setSettings>[0]) {
    await setSettings(patchObj);
  }
  const toggleCamera = async () => {
    setCamera((v) => !v);
    await patch({ camera: !camera });
  };
  const toggleMic = async () => {
    setMicrophone((v) => !v);
    await patch({ microphone: !microphone });
  };

  async function logout() {
    await api.logout().catch(() => {});
    await setSession(null);
    setSess(null);
  }

  if (loading) {
    return (
      <Frame>
        <div style={{ display: "flex", height: 176, alignItems: "center", justifyContent: "center" }}>
          <Spin />
        </div>
      </Frame>
    );
  }

  if (!session) {
    return (
      <Frame>
        <AuthForm
          onAuthed={(s) => {
            setSess(s);
            void refreshStatus();
          }}
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--line)",
          padding: "12px 16px",
        }}
      >
        <Logo size={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} (click to change)`}
            aria-label={`Theme: ${theme}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "var(--r-sm)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ink-3)",
            }}
          >
            {theme === "light" ? <Icons.Sun size={15} /> : theme === "dark" ? <Icons.Moon size={15} /> : <Icons.Monitor size={15} />}
          </button>
          <span className="mono" style={{ maxWidth: 132, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "var(--ink-4)" }}>
            {session.user.email}
          </span>
          <button onClick={logout} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: "var(--ink-3)" }}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>What are you capturing?</h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <ModeCard icon={Icons.Screen} label="Screen" sub="Full display" active checked />
            <ModeCard icon={Icons.Combo} label="Screen + Cam" sub="With your face" active={camera} checked={camera} onClick={toggleCamera} />
          </div>
        </div>

        <Section title="Recording settings">
          <DeviceRow
            icon={Icons.Mic}
            label="Microphone"
            on={microphone}
            onToggle={toggleMic}
            options={devices.mics}
            value={micDeviceId}
            onSelect={(id) => {
              setMicDeviceId(id);
              void patch({ micDeviceId: id });
            }}
          />
          <DeviceRow
            icon={Icons.Cam}
            label="Camera"
            on={camera}
            onToggle={toggleCamera}
            options={devices.cameras}
            value={cameraDeviceId}
            onSelect={(id) => {
              setCameraDeviceId(id);
              void patch({ cameraDeviceId: id });
            }}
          />
          <div style={{ borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--surface)", padding: "10px 12px" }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Quality</span>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {QUALITIES.map((q) => {
                const on = quality === q;
                return (
                  <button
                    key={q}
                    onClick={() => {
                      setQuality(q);
                      void patch({ quality: q });
                    }}
                    style={{
                      height: 30,
                      borderRadius: "var(--r-sm)",
                      border: "1.5px solid",
                      borderColor: on ? "var(--accent)" : "var(--line)",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                      color: on ? "var(--accent-ink)" : "var(--ink-3)",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "capitalize",
                      cursor: "pointer",
                      fontFamily: "var(--sans)",
                    }}
                  >
                    {q === "saver" ? "Saver" : q}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Save to">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <DestChip
              label={hostedStorage ? "Vyooom Cloud" : "Vyooom Cloud 🔒"}
              active={destination === StorageProvider.FLOWCAP}
              onClick={() => chooseDestination(StorageProvider.FLOWCAP)}
            />
            <DestChip label="Drive" icon="/assets/drive.png" active={destination === StorageProvider.DRIVE} disabled={!driveConnected} onClick={() => chooseDestination(StorageProvider.DRIVE)} />
            <DestChip label="Dropbox" icon="/assets/dropbox.png" active={destination === StorageProvider.DROPBOX} disabled={!dropboxConnected} onClick={() => chooseDestination(StorageProvider.DROPBOX)} />
          </div>
          {destination === StorageProvider.FLOWCAP &&
            (hostedStorage ? (
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "var(--ink-4)" }}>
                Recordings upload to <strong>Vyooom Cloud</strong> — hosted on Vyooom's servers, included in
                your plan. Connect Drive or Dropbox to keep files in your own storage instead.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "var(--warning)" }}>
                <strong>Vyooom Cloud needs Premium.</strong> Connect Drive or Dropbox below to record free with
                your own storage, or upgrade from the dashboard.
              </p>
            ))}
          {(driveBroken || dropboxBroken) && (
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "var(--warning)" }}>
              {driveBroken ? "Google Drive" : "Dropbox"} lost access (revoked or expired). Videos saved there
              won't play or upload until you reconnect.
            </p>
          )}
          {(!driveConnected || !dropboxConnected) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {!driveConnected && (
                <RButton variant="soft" size="sm" onClick={() => connect("drive")} disabled={connecting !== null}>
                  {connecting === "drive" ? "Connecting…" : driveBroken ? "Reconnect Drive" : "Connect Drive"}
                </RButton>
              )}
              {!dropboxConnected && (
                <RButton variant="soft" size="sm" onClick={() => connect("dropbox")} disabled={connecting !== null}>
                  {connecting === "dropbox" ? "Connecting…" : dropboxBroken ? "Reconnect Dropbox" : "Connect Dropbox"}
                </RButton>
              )}
            </div>
          )}
          {statusError && <p style={{ margin: 0, fontSize: 11, color: "var(--warning)" }}>{statusError}</p>}
        </Section>

        <div style={{ borderRadius: "var(--r)", border: "1px solid var(--line)" }}>
          <button
            onClick={() => setAdvanced((v) => !v)}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              border: "none",
              background: "transparent",
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            Advanced options
            <span style={{ transform: advanced ? "rotate(180deg)" : "none", transition: "transform var(--t1)", display: "inline-flex" }}>
              <Icons.ChevD size={14} />
            </span>
          </button>
          {advanced && (
            <div style={{ borderTop: "1px solid var(--line)", padding: "10px 12px" }}>
              <ToggleRow
                label="Recording countdown"
                hint="3-2-1 before recording starts"
                on={countdown}
                onToggle={() => {
                  setCountdown((v) => !v);
                  void patch({ countdown: !countdown });
                }}
              />
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <RButton variant="primary" icon={Icons.Reticle} onClick={record}>
            Record
          </RButton>
          <RButton variant="outline" icon={Icons.Shot} onClick={screenshot}>
            Screenshot
          </RButton>
        </div>
        <RButton variant="soft" full icon={Icons.Pen} onClick={whiteboard}>
          Record a whiteboard
        </RButton>

        {pending.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--warning)" }}>
              Unsaved recordings
            </span>
            {pending.map((p) => (
              <div key={p.id} style={{ borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--surface)", padding: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                    {(p.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
                {p.lastError && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--danger)", lineHeight: 1.4 }}>{p.lastError}</p>
                )}
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <RButton variant="primary" size="sm" onClick={() => recoverPending(p.id)}>
                    Upload / download
                  </RButton>
                  <RButton variant="outline" size="sm" onClick={() => void discardPending(p.id)}>
                    Discard
                  </RButton>
                </div>
              </div>
            ))}
          </section>
        )}

        {uploads.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Uploads</span>
            {uploads.map((u) => (
              <div key={u.id} style={{ borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--surface)", padding: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</span>
                  <StorageBadge provider={u.provider} />
                </div>
                {u.status === "uploading" && (
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar value={u.progress} />
                    {u.shareUrl && (
                      <button
                        onClick={() => void navigator.clipboard.writeText(u.shareUrl!)}
                        style={{ marginTop: 6, border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 11, color: "var(--accent-ink)", fontWeight: 600 }}
                      >
                        Link ready — copy it now (upload continues)
                      </button>
                    )}
                  </div>
                )}
                {u.status === "error" && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--danger)" }}>{u.error}</p>}
                {u.status === "done" && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--success)" }}>Uploaded</p>
                )}
              </div>
            ))}
          </section>
        )}

        <a
          href={`${config.webBaseUrl}/dashboard`}
          target="_blank"
          rel="noreferrer"
          style={{ textAlign: "center", fontSize: 11, color: "var(--ink-3)", textDecoration: "none" }}
        >
          Open dashboard →
        </a>
      </div>
    </Frame>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>{title}</span>
      {children}
    </section>
  );
}

function ModeCard({
  icon: Ico,
  label,
  sub,
  active,
  checked,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  sub: string;
  active: boolean;
  checked: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: 12,
        borderRadius: "var(--r-lg)",
        border: "1.5px solid",
        borderColor: active ? "var(--accent)" : "var(--line)",
        background: active ? "var(--accent-soft)" : "var(--surface)",
        boxShadow: active ? "0 0 0 3px var(--accent-ring)" : "var(--e1)",
        cursor: onClick ? "pointer" : "default",
        transition: "all var(--t2) var(--ease)",
        fontFamily: "var(--sans)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 32,
          height: 32,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          background: active ? "var(--accent)" : "var(--surface-2)",
          color: active ? "var(--accent-on)" : "var(--ink-2)",
          marginBottom: 9,
        }}
      >
        <Ico size={17} />
      </span>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>
      {checked && (
        <span style={{ position: "absolute", top: 10, right: 10, color: "var(--accent-ink)" }}>
          <Icons.Check size={15} />
        </span>
      )}
    </button>
  );
}

function DeviceRow({
  icon: Ico,
  label,
  on,
  onToggle,
  options,
  value,
  onSelect,
}: {
  icon: IconComponent;
  label: string;
  on: boolean;
  onToggle: () => void;
  options: { deviceId: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--surface)", padding: "8px 10px" }}>
      <span style={{ color: on ? "var(--ink)" : "var(--ink-4)" }}>
        <Ico size={17} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
      {on && <Waveform bars={7} height={14} active color="var(--accent)" width={2} />}
      <select
        disabled={!on}
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="mono"
        style={{
          marginLeft: "auto",
          maxWidth: 140,
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--line)",
          background: "var(--surface-2)",
          padding: "4px 6px",
          fontSize: 11,
          color: "var(--ink-2)",
          outline: "none",
          opacity: on ? 1 : 0.4,
        }}
      >
        <option value="">System default</option>
        {options.map((o) => (
          <option key={o.deviceId} value={o.deviceId}>
            {o.label}
          </option>
        ))}
      </select>
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--ink-4)" }}>{hint}</span>
      </span>
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

function DestChip({ label, icon, active, disabled, onClick }: { label: string; icon?: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        borderRadius: "var(--r)",
        border: "1.5px solid",
        borderColor: active ? "var(--accent)" : "var(--line)",
        background: active ? "var(--accent-soft)" : "var(--surface)",
        color: active ? "var(--accent-ink)" : "var(--ink-3)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontFamily: "var(--sans)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {icon && <img src={icon} alt="" style={{ width: 14, height: 14, objectFit: "contain" }} />}
      {label}
    </button>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 368, background: "var(--paper)", color: "var(--ink)" }}>{children}</div>;
}

function Spin() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: "2.5px solid var(--line-2)",
        borderTopColor: "var(--accent)",
        animation: "r-spin 0.7s linear infinite",
      }}
    />
  );
}
