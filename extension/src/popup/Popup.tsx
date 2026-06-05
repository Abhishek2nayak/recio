/**
 * Toolbar popup — the capture control surface. Structured like a recording-app setup
 * panel (capture mode → recording settings with device pickers → destination →
 * advanced options → Record / Screenshot), rendered in the Recio dark system.
 */
import { useCallback, useEffect, useState } from "react";
import { StorageProvider } from "@flowcap/shared";
import { api } from "../lib/api.js";
import { sendMessage, type UploadState } from "../lib/messages.js";
import { listDevices, type Devices } from "../lib/devices.js";
import { config } from "../config.js";
import {
  getSession,
  getSettings,
  setSession,
  setSettings,
  QUALITY_PRESETS,
  type RecordingQuality,
  type Session,
} from "../lib/storage.js";
import { AuthForm } from "./AuthForm.js";
import { Button, ProgressBar, Spinner, StorageBadge } from "../components/ui.js";

const QUALITIES: RecordingQuality[] = ["high", "standard", "saver"];

export function Popup() {
  const [loading, setLoading] = useState(true);
  const [session, setSess] = useState<Session | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [destination, setDestination] = useState<StorageProvider>(StorageProvider.FLOWCAP);
  const [connecting, setConnecting] = useState<null | "drive" | "dropbox">(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
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

  const refreshStatus = useCallback(async () => {
    try {
      const status = await api.storageStatus();
      setDriveConnected(status.connections.some((c) => c.provider === StorageProvider.DRIVE && c.isActive));
      setDropboxConnected(status.connections.some((c) => c.provider === StorageProvider.DROPBOX && c.isActive));
      setDestination(status.defaultProvider);
      setStatusError(null);
    } catch {
      setStatusError("Couldn't reach the Recio server.");
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

  // Poll in-flight uploads from the SW while the popup is open.
  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      const res = await sendMessage({ type: "GET_UPLOADS" });
      if (res.ok && res.uploads) setUploads(res.uploads);
    };
    void poll();
    const t = setInterval(poll, 1000);
    return () => clearInterval(t);
  }, [session]);

  async function record() {
    // Recording happens on the studio page (a real extension page — it has
    // chrome.storage + the upload pipeline; an offscreen document does not).
    await sendMessage({ type: "OPEN_STUDIO" });
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
        <div className="flex h-44 items-center justify-center">
          <Spinner className="text-muted" />
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
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-highlight">
            <RecioMark />
          </span>
          Recio
        </span>
        <div className="flex items-center gap-2">
          <span className="max-w-[150px] truncate font-mono text-[11px] text-muted">{session.user.email}</span>
          <button className="text-[11px] text-muted hover:text-text-primary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* Capture mode */}
        <div className="grid grid-cols-2 gap-2">
          <ModeCard icon={<ScreenGlyph />} label="Screen" active checked />
          <ModeCard icon={<CameraGlyph />} label="Camera" active={camera} checked={camera} onClick={toggleCamera} />
        </div>

        {/* Recording settings */}
        <Section title="Recording settings">
          <DeviceRow
            icon={<MicGlyph />}
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
            icon={<CameraGlyph />}
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

          {/* Quality */}
          <div className="rounded-md border border-border bg-bg-secondary px-3 py-2.5">
            <span className="text-xs text-muted">Quality</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuality(q);
                    void patch({ quality: q });
                  }}
                  className={
                    "rounded-md border px-2 py-1.5 text-xs capitalize transition-colors " +
                    (quality === q
                      ? "border-accent bg-accent/10 text-text-primary"
                      : "border-border bg-bg-card text-muted hover:border-muted")
                  }
                >
                  {q === "saver" ? "Saver" : q}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Save to */}
        <Section title="Save to">
          <div className="grid grid-cols-3 gap-2">
            <DestChip label="Recio" active={destination === StorageProvider.FLOWCAP} onClick={() => chooseDestination(StorageProvider.FLOWCAP)} />
            <DestChip label="Drive" active={destination === StorageProvider.DRIVE} disabled={!driveConnected} onClick={() => chooseDestination(StorageProvider.DRIVE)} />
            <DestChip label="Dropbox" active={destination === StorageProvider.DROPBOX} disabled={!dropboxConnected} onClick={() => chooseDestination(StorageProvider.DROPBOX)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {!driveConnected && (
              <Button variant="secondary" onClick={() => connect("drive")} disabled={connecting !== null} className="text-xs">
                {connecting === "drive" ? <Spinner /> : "Connect Drive"}
              </Button>
            )}
            {!dropboxConnected && (
              <Button variant="secondary" onClick={() => connect("dropbox")} disabled={connecting !== null} className="text-xs">
                {connecting === "dropbox" ? <Spinner /> : "Connect Dropbox"}
              </Button>
            )}
          </div>
          {statusError && <p className="text-[11px] text-warning">{statusError}</p>}
        </Section>

        {/* Advanced options */}
        <div className="rounded-md border border-border">
          <button
            onClick={() => setAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-muted hover:text-text-primary"
          >
            Advanced options
            <Chevron open={advanced} />
          </button>
          {advanced && (
            <div className="border-t border-border px-3 py-2">
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

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="highlight" onClick={record} className="py-2.5">
            <RecordDot /> Record Now
          </Button>
          <Button variant="secondary" onClick={screenshot} className="py-2.5">
            <CameraGlyph /> Screenshot
          </Button>
        </div>
        <Button variant="secondary" onClick={whiteboard} className="w-full py-2.5">
          <BoardGlyph /> Record a whiteboard
        </Button>

        {/* In-flight uploads */}
        {uploads.length > 0 && (
          <section className="flex flex-col gap-2">
            <span className="text-xs text-muted">Uploads</span>
            {uploads.map((u) => (
              <div key={u.id} className="rounded-md border border-border bg-bg-secondary p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="max-w-[200px] truncate">{u.title}</span>
                  <StorageBadge provider={u.provider} />
                </div>
                {u.status === "uploading" && (
                  <div className="mt-1.5">
                    <ProgressBar value={u.progress} />
                  </div>
                )}
                {u.status === "error" && <p className="mt-1 text-[11px] text-danger">{u.error}</p>}
                {u.status === "done" && <p className="mt-1 text-[11px] text-success">Uploaded</p>}
              </div>
            ))}
          </section>
        )}

        <a
          href={`${config.webBaseUrl}/dashboard`}
          target="_blank"
          rel="noreferrer"
          className="text-center text-[11px] text-accent hover:text-accent-hover"
        >
          Open dashboard →
        </a>
      </div>
    </Frame>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</span>
      {children}
    </section>
  );
}

function ModeCard({
  icon,
  label,
  active,
  checked,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  checked: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={
        "flex items-center justify-between rounded-md border px-3 py-2.5 text-sm transition-colors " +
        (active ? "border-accent bg-accent/10 text-text-primary" : "border-border bg-bg-secondary text-muted hover:border-muted") +
        (onClick ? " cursor-pointer" : " cursor-default")
      }
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={"flex h-4 w-4 items-center justify-center rounded border " + (checked ? "border-accent bg-accent text-white" : "border-border")}>
        {checked && <CheckGlyph />}
      </span>
    </button>
  );
}

function DeviceRow({
  icon,
  label,
  on,
  onToggle,
  options,
  value,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onToggle: () => void;
  options: { deviceId: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg-secondary px-2.5 py-2">
      <button onClick={onToggle} className={"flex items-center gap-2 text-sm " + (on ? "text-text-primary" : "text-muted")}>
        <span className={on ? "text-accent" : "text-muted"}>{icon}</span>
        {label}
      </button>
      <select
        disabled={!on}
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="ml-auto max-w-[150px] truncate rounded border border-border bg-bg-card px-2 py-1 text-[11px] text-text-primary outline-none disabled:opacity-40"
      >
        <option value="">System default</option>
        {options.map((o) => (
          <option key={o.deviceId} value={o.deviceId}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (on ? "bg-success" : "bg-muted")} />
    </div>
  );
}

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between py-1.5 text-left">
      <span>
        <span className="block text-xs text-text-primary">{label}</span>
        <span className="block text-[10px] text-muted">{hint}</span>
      </span>
      <span className={"relative h-5 w-9 shrink-0 rounded-full transition-colors " + (on ? "bg-accent" : "bg-border")}>
        <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " + (on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function DestChip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-md border px-3 py-2 text-xs transition-colors " +
        (active ? "border-accent bg-accent/10 text-text-primary" : "border-border bg-bg-secondary text-muted hover:border-muted") +
        (disabled ? " cursor-not-allowed opacity-50" : "")
      }
    >
      {label}
    </button>
  );
}

function RecioMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" fill="none">
      <g stroke="currentColor" strokeWidth="5.5" strokeLinecap="round">
        <path d="M31 9.5a16 16 0 0 0-17 28" />
        <path d="M17 38.5a16 16 0 0 0 17-28" />
      </g>
      <circle cx="24" cy="24" r="5" fill="currentColor" />
    </svg>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="w-[368px] bg-bg-primary text-text-primary">{children}</div>;
}

// ── glyphs ──────────────────────────────────────────────────────────────────
const s = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function ScreenGlyph() {
  return (<svg {...s}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>);
}
function CameraGlyph() {
  return (<svg {...s}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></svg>);
}
function MicGlyph() {
  return (<svg {...s}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
}
function BoardGlyph() {
  return (<svg {...s}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M9 21h6M12 17v4M7.5 12 10 9.5l2 2 3-3.5" /></svg>);
}
function CheckGlyph() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);
}
function RecordDot() {
  return <span className="mr-0.5 inline-block h-2.5 w-2.5 rounded-full bg-current" />;
}
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-180 transition-transform" : "transition-transform"}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
