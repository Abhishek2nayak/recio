/**
 * Studio page — where a screen recording happens (a real tab; MV3 SWs can't use
 * MediaRecorder). Flow: setup (camera/mic) → recording (floating bar + camera
 * bubble) → AUTO-upload to the user's default destination → shareable link.
 *
 * Per product spec it never asks "where to save" — it uploads to the saved default
 * and surfaces the link immediately.
 */
import { useEffect, useRef, useState } from "react";
import { StorageProvider, formatDuration } from "@flowcap/shared";
import { ScreenRecorder, type RecordingResult } from "../recorder/screenRecorder.js";
import { publishCapture } from "../storage/publish.js";
import { Button, Spinner, StorageBadge } from "../components/ui.js";
import { useFlowcap } from "../lib/useFlowcap.js";
import { getSettings, setSettings, QUALITY_PRESETS, type RecordingQuality, type Settings } from "../lib/storage.js";
import { sendMessage, type Message } from "../lib/messages.js";
import { config } from "../config.js";

type Phase = "loading" | "need-auth" | "idle" | "countdown" | "recording" | "paused" | "uploading" | "done" | "error";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function defaultTitle(): string {
  const stamp = new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Recording — ${stamp}`;
}

/** "whiteboard" → record the embedded Excalidraw canvas; default "screen". */
const recordMode: "screen" | "whiteboard" =
  new URLSearchParams(window.location.search).get("mode") === "whiteboard" ? "whiteboard" : "screen";

export function Studio() {
  const ctx = useFlowcap();
  const recorderRef = useRef<ScreenRecorder | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const finishingRef = useRef(false);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const [phase, setPhase] = useState<Phase>("loading");
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [countValue, setCountValue] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [detailUrl, setDetailUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load auth + settings.
  useEffect(() => {
    if (ctx.loading) return;
    if (!ctx.session) {
      setPhase("need-auth");
      return;
    }
    void getSettings().then((s) => {
      setLocalSettings(s);
      setPhase("idle");
    });
  }, [ctx.loading, ctx.session]);

  // Mirror the captured display stream into the studio's live preview element.
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const v = previewRef.current;
    const stream = recorderRef.current?.previewStream ?? null;
    if (v && stream && v.srcObject !== stream) {
      v.srcObject = stream;
      void v.play().catch(() => {});
    }
  }, [phase]);

  // Live timer + broadcast state to the SW so the on-page bar can mirror it.
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const t = setInterval(() => {
      const ms = recorderRef.current?.elapsedMs ?? 0;
      setElapsed(ms);
      void sendMessage({ type: "RECORDING_TICK", state: phase, elapsedMs: ms });
    }, 300);
    return () => clearInterval(t);
  }, [phase]);

  // Accept remote controls from the on-page floating bar (relayed by the SW).
  const controlRef = useRef({ pause: () => {}, resume: () => {}, stop: () => {} });
  useEffect(() => {
    const listener = (msg: Message) => {
      if (msg.type === "RECORDING_CONTROL") {
        if (msg.action === "pause") controlRef.current.pause();
        if (msg.action === "resume") controlRef.current.resume();
        if (msg.action === "stop") controlRef.current.stop();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // After a successful upload, hand off to the Loom-style web detail page where the
  // user can rename, preview, and manage sharing.
  useEffect(() => {
    if (phase !== "done" || !detailUrl) return;
    const t = setTimeout(() => {
      window.location.href = detailUrl;
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, detailUrl]);

  async function updateSetting(patch: Partial<Settings>) {
    const next = await setSettings(patch);
    setLocalSettings(next);
  }

  async function start() {
    if (!settings) return;
    setError(null);

    const recorder = new ScreenRecorder();
    recorderRef.current = recorder;
    finishingRef.current = false;
    try {
      const preset = QUALITY_PRESETS[settings.quality];
      // prepare() shows the screen picker (needs the gesture); recording starts at begin().
      await recorder.prepare({
        microphone: settings.microphone,
        micDeviceId: settings.micDeviceId,
        frameRate: preset.frameRate,
        videoBitsPerSecond: preset.videoBitsPerSecond,
        preferCurrentTab: recordMode === "whiteboard",
        // Native "Stop sharing" / closing the shared window ends the recording on
        // its own — finalize + upload automatically so nothing gets stuck.
        onEnded: (result) => void finishRecording(result),
      });

      if (settings.countdown) {
        setPhase("countdown");
        for (let n = 3; n >= 1; n--) {
          setCountValue(n);
          await delay(800);
        }
      }

      recorder.begin();
      setPhase("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start recording.";
      setError(msg);
      setPhase(/denied|cancel|Permission/i.test(msg) ? "idle" : "error");
    }
  }

  function pause() {
    recorderRef.current?.pause();
    setPhase("paused");
  }
  function resume() {
    recorderRef.current?.resume();
    setPhase("recording");
  }
  function cancel() {
    finishingRef.current = true; // suppress any in-flight onEnded
    recorderRef.current?.discard();
    setPhase("idle");
    setElapsed(0);
    void sendMessage({ type: "RECORDING_ENDED" });
  }

  async function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const result = await recorder.stop();
    await finishRecording(result);
  }

  /** Finalize once (from manual stop OR auto-end): upload to the default + share. */
  async function finishRecording(result: RecordingResult) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    void sendMessage({ type: "RECORDING_ENDED" });
    setPhase("uploading");
    setProgress(0);
    try {
      const { mediaId, shareUrl: url } = await publishCapture({
        blob: result.blob,
        title: defaultTitle(),
        type: "recording",
        destination: ctxRef.current.defaultDestination, // upload to what we displayed
        durationMs: result.durationMs,
        recorderMime: result.mimeType,
        onProgress: setProgress,
      });
      setShareUrl(url);
      setDetailUrl(`${config.webBaseUrl}/recordings/${mediaId}`);
      setPhase("done");
      void sendMessage({ type: "STUDIO_PUBLISHED", shareUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPhase("error");
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Keep the remote-control ref pointing at the latest handlers.
  controlRef.current = { pause, resume, stop: () => void stop() };

  // ── Render ──
  if (phase === "loading" || ctx.loading) {
    return (
      <Centered>
        <Spinner className="text-muted" />
      </Centered>
    );
  }

  if (phase === "need-auth") {
    return (
      <Centered>
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Sign in to record</h1>
          <p className="mt-2 text-sm text-muted">Open the Recio toolbar popup to sign in, then start here.</p>
        </div>
      </Centered>
    );
  }

  // ── Whiteboard mode: full-bleed Excalidraw canvas (embedded) + record controls ──
  if (recordMode === "whiteboard" && ["idle", "countdown", "recording", "paused"].includes(phase)) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-bg-primary">
        <iframe
          src={`${config.webBaseUrl}/whiteboard/embed`}
          title="Whiteboard"
          allow="clipboard-write; clipboard-read"
          className="absolute inset-0 h-full w-full border-0"
        />

        {(phase === "recording" || phase === "paused") && settings?.camera && (
          <CameraBubble deviceId={settings.cameraDeviceId} />
        )}

        {phase === "countdown" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="font-mono text-[168px] font-bold leading-none text-highlight drop-shadow-[0_6px_30px_rgba(0,0,0,.45)]">
              {countValue}
            </span>
          </div>
        )}

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/95 px-5 py-4 shadow-lg backdrop-blur">
              <Button variant="highlight" onClick={start} className="px-5 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0A0A0A]" /> Start recording
              </Button>
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                Draw on the board · saves to <StorageBadge provider={ctx.defaultDestination} />
              </p>
            </div>
          )}
          {(phase === "recording" || phase === "paused") && (
            <div className="flex items-center gap-3 rounded-full border border-border bg-[#0f0f11]/95 px-3 py-2 shadow-2xl backdrop-blur">
              <button
                onClick={() => void stop()}
                title="Stop & save"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
              >
                <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
              </button>
              <span className="flex items-center gap-1.5">
                <span className={"h-2 w-2 rounded-full " + (phase === "recording" ? "animate-pulse bg-danger" : "bg-warning")} />
                <span className="font-mono text-sm tabular-nums text-white">{formatDuration(elapsed / 1000)}</span>
              </span>
              <button
                onClick={phase === "recording" ? pause : resume}
                title={phase === "recording" ? "Pause" : "Resume"}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white"
              >
                {phase === "recording" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
                )}
              </button>
              <button
                onClick={cancel}
                title="Discard"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/20 hover:text-danger"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Centered>
      {phase === "idle" && settings && (
        <div className="flex w-[420px] flex-col items-center gap-6 text-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ready to record</h1>
            <p className="mt-1 text-sm text-muted">Pick your screen, window, or tab in the next prompt.</p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Toggle
              label="Camera"
              hint="Draggable webcam bubble, shown on the page you record"
              checked={settings.camera}
              onChange={(v) => void updateSetting({ camera: v })}
            />
            <Toggle
              label="Microphone"
              hint="Mix your mic into the audio"
              checked={settings.microphone}
              onChange={(v) => void updateSetting({ microphone: v })}
            />

            {/* Quality preset */}
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
              <span className="text-sm font-medium text-text-primary">Quality</span>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(["high", "standard", "saver"] as RecordingQuality[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => void updateSetting({ quality: q })}
                    className={
                      "rounded-md border px-2 py-1.5 text-xs capitalize transition-colors " +
                      (settings.quality === q
                        ? "border-accent bg-accent/10 text-text-primary"
                        : "border-border bg-bg-secondary text-muted hover:border-muted")
                    }
                  >
                    {q === "saver" ? "Saver" : q}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">{QUALITY_PRESETS[settings.quality].label}</p>
            </div>
          </div>

          <Button onClick={start} className="w-full py-3 text-base">
            Start recording
          </Button>

          <p className="flex items-center gap-1.5 text-xs text-muted">
            Saves to <StorageBadge provider={ctx.defaultDestination} /> automatically
          </p>
        </div>
      )}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-accent text-5xl font-semibold text-accent">
            {countValue}
          </div>
          <p className="text-sm text-muted">Get ready…</p>
        </div>
      )}

      {(phase === "recording" || phase === "paused") && (
        <div className="flex w-[620px] max-w-[92vw] flex-col items-center gap-5">
          {/* Live preview of the shared screen — "what's being recorded". */}
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black shadow-sm">
            <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full bg-black object-contain" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-xs font-medium text-white backdrop-blur">
              <span className={"h-2 w-2 rounded-full " + (phase === "recording" ? "animate-pulse bg-danger" : "bg-warning")} />
              {phase === "recording" ? "REC" : "Paused"} · {formatDuration(elapsed / 1000)}
            </span>
          </div>

          <p className="text-center text-xs text-muted">
            Switch to the screen, window, or tab you're recording — your controls and camera bubble follow you there.
          </p>

          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={phase === "recording" ? pause : resume}>
              {phase === "recording" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
              )}
              {phase === "recording" ? "Pause" : "Resume"}
            </Button>
            <Button variant="highlight" onClick={() => void stop()}>
              <span className="h-3 w-3 rounded-[3px] bg-[#0A0A0A]" /> Stop &amp; save
            </Button>
            <Button variant="ghost" className="hover:text-danger" onClick={cancel}>
              Discard
            </Button>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted">
            Saves to <StorageBadge provider={ctx.defaultDestination} /> automatically
          </p>
        </div>
      )}

      {phase === "uploading" && (
        <div className="w-[360px] text-center">
          <Spinner className="text-accent" />
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            Uploading to <StorageBadge provider={ctx.defaultDestination} />
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted">{Math.round(progress * 100)}%</p>
        </div>
      )}

      {phase === "done" && shareUrl && (
        <div className="w-[420px] text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold">Recording saved</h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted">
            Stored in <StorageBadge provider={ctx.defaultDestination} /> · opening editor…
          </p>
          <div className="mt-5 flex gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 font-mono text-xs outline-none"
            />
            <Button onClick={copyLink}>{copied ? "Copied" : "Copy"}</Button>
          </div>
          <div className="mt-4 flex justify-center gap-3">
            {detailUrl && (
              <a href={detailUrl} className="text-sm text-accent hover:text-accent-hover">
                Open now →
              </a>
            )}
            <button
              onClick={() => {
                setShareUrl(null);
                setDetailUrl(null);
                setPhase("idle");
                setElapsed(0);
                finishingRef.current = false;
              }}
              className="text-sm text-muted hover:text-text-primary"
            >
              Record another
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="max-w-sm text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => { setError(null); setPhase("idle"); }}>
            Back
          </Button>
        </div>
      )}
    </Centered>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={
        "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors " +
        (checked ? "border-accent bg-accent/10" : "border-border bg-card hover:border-muted")
      }
    >
      <span>
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
      <span className={"relative h-6 w-11 shrink-0 rounded-full transition-colors " + (checked ? "bg-accent" : "bg-border")}>
        <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " + (checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-primary p-6">{children}</div>
  );
}

/** Presenter webcam bubble over the whiteboard (captured by the tab recording). */
function CameraBubble({ deviceId }: { deviceId: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (ref.current) ref.current.srcObject = s;
      })
      .catch(() => {});
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [deviceId]);

  return (
    <div className="absolute bottom-6 left-6 h-40 w-40 overflow-hidden rounded-full border-[3px] border-white/90 bg-black shadow-2xl">
      <video ref={ref} autoPlay muted playsInline className="h-full w-full object-cover" />
    </div>
  );
}
