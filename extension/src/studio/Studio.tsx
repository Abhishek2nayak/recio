/**
 * Studio page — where a screen recording happens (a real tab; MV3 SWs can't use
 * MediaRecorder). Flow: setup (camera/mic) → recording (floating bar + camera
 * bubble) → AUTO-upload to the user's default destination → shareable link.
 *
 * Per product spec it never asks "where to save" — it uploads to the saved default
 * and surfaces the link immediately. Rendered in the Vyooom design system.
 */
import { useEffect, useRef, useState } from "react";
import { formatDuration, sanitizeFileName } from "@flowcap/shared";
import { ScreenRecorder, type RecordingResult } from "../recorder/screenRecorder.js";
import { publishCapture } from "../storage/publish.js";
import { deletePending, getPending, type PendingUpload } from "../lib/pendingUploads.js";
import { StorageBadge } from "../components/ui.js";
import { Icons, IconBtn, Logo, RButton, ReticleMark, Tag, Toggle, Waveform } from "../components/recio/index.js";
import { useFlowcap } from "../lib/useFlowcap.js";
import {
  getSettings,
  setSettings,
  QUALITY_PRESETS,
  CAMERA_SIZE_PX,
  type CameraCorner,
  type CameraSize,
  type RecordingQuality,
  type Settings,
} from "../lib/storage.js";
import { sendMessage, type Message } from "../lib/messages.js";
import { config } from "../config.js";

type Phase = "loading" | "need-auth" | "idle" | "countdown" | "recording" | "paused" | "uploading" | "done" | "error" | "recover";

/** The last capture (or recovered pending upload) — kept so a failed upload can be retried or downloaded. */
interface CaptureInHand {
  pendingId: string;
  title: string;
  type: "recording" | "screenshot";
  blob: Blob;
  durationMs: number;
  mimeType: string;
  /** Metadata row from a previous attempt — retries keep the same share link. */
  mediaId?: string;
}

/** Save a capture's bytes as a local file (the always-works escape hatch). */
function downloadCapture(capture: CaptureInHand): void {
  const ext = capture.type === "screenshot" ? "png" : capture.mimeType.includes("mp4") ? "mp4" : "webm";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(capture.blob);
  a.download = `${sanitizeFileName(capture.title) || "recording"}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function defaultTitle(): string {
  const stamp = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const captureRef = useRef<CaptureInHand | null>(null);
  const [hasCapture, setHasCapture] = useState(false);

  useEffect(() => {
    if (ctx.loading) return;
    if (!ctx.session) {
      setPhase("need-auth");
      return;
    }
    void getSettings().then(async (s) => {
      setLocalSettings(s);
      // Opened from the popup's "Unsaved recordings" list — load it for recovery.
      const recoverId = new URLSearchParams(window.location.search).get("recover");
      const item: PendingUpload | null = recoverId ? await getPending(recoverId) : null;
      if (item) {
        captureRef.current = {
          pendingId: item.id,
          title: item.title,
          type: item.type,
          blob: item.blob,
          durationMs: item.durationMs,
          mimeType: item.mimeType,
          mediaId: item.mediaId,
        };
        setHasCapture(true);
        setError(item.lastError ?? null);
        setPhase("recover");
        return;
      }
      setPhase("idle");
    });
  }, [ctx.loading, ctx.session]);

  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const v = previewRef.current;
    const stream = recorderRef.current?.previewStream ?? null;
    if (v && stream && v.srcObject !== stream) {
      v.srcObject = stream;
      void v.play().catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const t = setInterval(() => {
      const ms = recorderRef.current?.elapsedMs ?? 0;
      setElapsed(ms);
      void sendMessage({ type: "RECORDING_TICK", state: phase, elapsedMs: ms });
    }, 300);
    return () => clearInterval(t);
  }, [phase]);

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
      await recorder.prepare({
        microphone: settings.microphone,
        micDeviceId: settings.micDeviceId,
        frameRate: preset.frameRate,
        videoBitsPerSecond: preset.videoBitsPerSecond,
        // Always show the full screen picker (tab / window / entire screen) — even
        // in whiteboard mode — so the user chooses what to share.
        preferCurrentTab: false,
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
    finishingRef.current = true;
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

  async function finishRecording(result: RecordingResult) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    void sendMessage({ type: "RECORDING_ENDED" });
    captureRef.current = {
      pendingId: crypto.randomUUID(),
      title: defaultTitle(),
      type: "recording",
      blob: result.blob,
      durationMs: result.durationMs,
      mimeType: result.mimeType,
    };
    setHasCapture(true);
    await publishCurrentCapture();
  }

  /** Upload whatever is in hand (fresh recording OR a recovered pending upload). */
  async function publishCurrentCapture() {
    const capture = captureRef.current;
    if (!capture) return;
    setPhase("uploading");
    setProgress(0);
    try {
      const { mediaId, shareUrl: url } = await publishCapture({
        blob: capture.blob,
        title: capture.title,
        type: capture.type,
        destination: ctxRef.current.defaultDestination,
        durationMs: capture.durationMs,
        recorderMime: capture.mimeType,
        pendingId: capture.pendingId,
        mediaId: capture.mediaId,
        // Instant link: the share URL exists before the bytes finish — surface and
        // auto-copy it right away (the upload keeps running below).
        onLinkReady: (linkUrl, readyMediaId) => {
          if (captureRef.current) captureRef.current.mediaId = readyMediaId;
          setShareUrl(linkUrl);
          setDetailUrl(`${config.webBaseUrl}/recordings/${readyMediaId}`);
          navigator.clipboard.writeText(linkUrl).then(() => setCopied(true)).catch(() => {});
          setTimeout(() => setCopied(false), 2500);
        },
        onProgress: setProgress,
      });
      captureRef.current = null;
      setHasCapture(false);
      setShareUrl(url);
      setDetailUrl(`${config.webBaseUrl}/recordings/${mediaId}`);
      setPhase("done");
      void sendMessage({ type: "STUDIO_PUBLISHED", shareUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPhase("error");
    }
  }

  async function discardCapture() {
    const capture = captureRef.current;
    if (capture) await deletePending(capture.pendingId).catch(() => {});
    captureRef.current = null;
    setHasCapture(false);
    setError(null);
    setPhase("idle");
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  controlRef.current = { pause, resume, stop: () => void stop() };

  // ── Render ──
  if (phase === "loading" || ctx.loading) {
    return (
      <Centered>
        <Spin />
      </Centered>
    );
  }

  if (phase === "need-auth") {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, color: "var(--accent)" }}>
            <ReticleMark size={44} sw={1.6} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Sign in to record</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
            Open the Vyooom toolbar popup to sign in, then start here.
          </p>
        </div>
      </Centered>
    );
  }

  // ── Whiteboard mode ──
  if (recordMode === "whiteboard" && ["idle", "countdown", "recording", "paused"].includes(phase)) {
    return (
      <div style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden", background: "var(--paper)" }}>
        <iframe
          src={`${config.webBaseUrl}/whiteboard/embed`}
          title="Whiteboard"
          allow="clipboard-write; clipboard-read"
          style={{ position: "absolute", inset: 0, height: "100%", width: "100%", border: 0 }}
        />
        {(phase === "recording" || phase === "paused") && settings?.camera && <CameraBubble deviceId={settings.cameraDeviceId} />}
        {phase === "countdown" && <Countdown n={countValue} />}
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)" }}>
          {phase === "idle" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                borderRadius: "var(--r-xl)",
                border: "1px solid var(--line)",
                background: "color-mix(in oklch, var(--surface) 95%, transparent)",
                padding: "16px 20px",
                boxShadow: "var(--e3)",
                backdropFilter: "blur(8px)",
              }}
            >
              <RButton variant="primary" icon={Icons.Reticle} onClick={start}>
                Start recording
              </RButton>
              <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", margin: 0 }}>
                Draw on the board · saves to <StorageBadge provider={ctx.defaultDestination} />
              </p>
            </div>
          )}
          {(phase === "recording" || phase === "paused") && (
            <RecDock
              phase={phase}
              elapsed={elapsed}
              onStop={() => void stop()}
              onToggle={phase === "recording" ? pause : resume}
              onCancel={cancel}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <Centered>
      {phase === "idle" && settings && (
        <div style={{ width: 460, animation: "r-fade-up var(--t3, 360ms) var(--ease, ease) both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
            <Logo size={26} />
            <Tag tone="accent" style={{ marginLeft: "auto" }}>
              <Icons.Reticle size={11} /> Studio
            </Tag>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em" }}>Ready to capture</h1>
          <p style={{ margin: "0 0 18px", color: "var(--ink-3)", fontSize: 15, lineHeight: 1.5 }}>
            Check your camera & mic, then pick your screen, window, or tab.
          </p>

          {/* live preview */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: 16,
              boxShadow: "var(--e1)",
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <CameraPreview on={settings.camera} deviceId={settings.cameraDeviceId} size={settings.cameraSize} />
            <MicMeter on={settings.microphone} deviceId={settings.micDeviceId} />

            {settings.camera && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)" }}>Size</span>
                  {(["small", "medium", "large"] as CameraSize[]).map((sz) => {
                    const on = settings.cameraSize === sz;
                    return (
                      <button
                        key={sz}
                        onClick={() => void updateSetting({ cameraSize: sz })}
                        style={chipStyle(on)}
                      >
                        {sz.charAt(0).toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)" }}>Corner</span>
                  <CornerPicker value={settings.cameraCorner} onChange={(c) => void updateSetting({ cameraCorner: c })} />
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: 6,
              boxShadow: "var(--e1)",
              marginBottom: 18,
            }}
          >
            <SettingRow
              icon={Icons.Cam}
              label="Camera"
              sub="Draggable webcam bubble on the page"
              on={settings.camera}
              onToggle={(v) => void updateSetting({ camera: v })}
              showWave
            />
            <SettingRow
              icon={Icons.Mic}
              label="Microphone"
              sub="Mix your mic into the audio"
              on={settings.microphone}
              onToggle={(v) => void updateSetting({ microphone: v })}
              showWave
              divider
            />
            <div style={{ padding: "11px 12px", borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ color: "var(--ink)" }}>
                  <Icons.Bolt size={19} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Quality</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                    {QUALITY_PRESETS[settings.quality].label}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {(["high", "standard", "saver"] as RecordingQuality[]).map((q) => {
                  const on = settings.quality === q;
                  return (
                    <button
                      key={q}
                      onClick={() => void updateSetting({ quality: q })}
                      style={{
                        height: 34,
                        borderRadius: "var(--r)",
                        border: "1.5px solid",
                        borderColor: on ? "var(--accent)" : "var(--line)",
                        background: on ? "var(--accent-soft)" : "var(--surface)",
                        color: on ? "var(--accent-ink)" : "var(--ink-2)",
                        fontSize: 12.5,
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
          </div>

          <RButton variant="primary" size="lg" full icon={Icons.Reticle} onClick={start}>
            Start recording
          </RButton>
          <p style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14, fontSize: 12, color: "var(--ink-4)" }}>
            Saves to <StorageBadge provider={ctx.defaultDestination} /> automatically
          </p>
        </div>
      )}

      {phase === "countdown" && <Countdown n={countValue} />}

      {(phase === "recording" || phase === "paused") && (
        <div style={{ display: "flex", width: 620, maxWidth: "92vw", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              overflow: "hidden",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--line)",
              background: "var(--hud)",
              boxShadow: "var(--e3)",
            }}
          >
            <video ref={previewRef} autoPlay muted playsInline style={{ aspectRatio: "16 / 9", width: "100%", background: "var(--hud)", objectFit: "contain", display: "block" }} />
            <span
              className="mono"
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                borderRadius: "var(--r-pill)",
                background: "rgba(0,0,0,.55)",
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "white",
                backdropFilter: "blur(4px)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: phase === "recording" ? "var(--live)" : "var(--hud-ink-2)",
                  animation: phase === "recording" ? "r-live-blink 1.4s steps(1) infinite" : "none",
                }}
              />
              {phase === "recording" ? "REC" : "PAUSED"} · {formatDuration(elapsed / 1000)}
            </span>
          </div>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink-3)", margin: 0, maxWidth: 460, lineHeight: 1.5 }}>
            Switch to the screen, window, or tab you're recording — your controls and camera bubble follow you there.
          </p>
          <RecDock
            phase={phase}
            elapsed={elapsed}
            onStop={() => void stop()}
            onToggle={phase === "recording" ? pause : resume}
            onCancel={cancel}
          />
          <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-4)", margin: 0 }}>
            Saves to <StorageBadge provider={ctx.defaultDestination} /> automatically
          </p>
        </div>
      )}

      {phase === "uploading" && (
        <div style={{ width: 440, textAlign: "center" }}>
          {shareUrl ? (
            <>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {copied ? "Link copied — share it now" : "Your link is ready"}
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
                The video keeps uploading in the background; viewers see it the moment it lands.
              </p>
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mono"
                  style={{ flex: 1, minWidth: 0, height: 40, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface-2)", padding: "0 12px", fontSize: 12, color: "var(--ink-2)", outline: "none" }}
                />
                <RButton
                  variant={copied ? "primary" : "dark"}
                  icon={copied ? Icons.Check : Icons.Copy}
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </RButton>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Spin />
            </div>
          )}
          <p style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, fontSize: 14, color: "var(--ink-2)", margin: shareUrl ? "18px 0 0" : 0 }}>
            Uploading to <StorageBadge provider={ctx.defaultDestination} />
          </p>
          <div style={{ marginTop: 14, height: 8, width: "100%", overflow: "hidden", borderRadius: 99, background: "var(--surface-3)" }}>
            <div style={{ height: "100%", borderRadius: 99, background: "var(--accent)", width: `${Math.round(progress * 100)}%`, transition: "width var(--t2, 220ms)" }} />
          </div>
          <p className="mono" style={{ marginTop: 8, fontSize: 12, color: "var(--ink-4)" }}>
            {Math.round(progress * 100)}%
          </p>
        </div>
      )}

      {phase === "done" && shareUrl && (
        <div style={{ width: 440, textAlign: "center" }}>
          <div
            style={{
              margin: "0 auto",
              display: "flex",
              height: 52,
              width: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "var(--accent-soft)",
              color: "var(--accent-ink)",
            }}
          >
            <Icons.Check size={26} />
          </div>
          <h1 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Recording saved</h1>
          <p style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-3)" }}>
            Stored in <StorageBadge provider={ctx.defaultDestination} /> · opening editor…
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="mono"
              style={{
                flex: 1,
                minWidth: 0,
                height: 40,
                borderRadius: "var(--r)",
                border: "1px solid var(--line-2)",
                background: "var(--surface-2)",
                padding: "0 12px",
                fontSize: 12,
                color: "var(--ink-2)",
                outline: "none",
              }}
            />
            <RButton variant={copied ? "primary" : "dark"} icon={copied ? Icons.Check : Icons.Copy} onClick={copyLink}>
              {copied ? "Copied" : "Copy"}
            </RButton>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 14 }}>
            {detailUrl && (
              <a href={detailUrl} style={{ fontSize: 13, color: "var(--accent-ink)", textDecoration: "none", fontWeight: 600 }}>
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
              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--ink-3)" }}
            >
              Record another
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--danger)" }}>{error}</p>
          {hasCapture ? (
            <>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8 }}>
                <RButton variant="primary" onClick={() => void publishCurrentCapture()}>
                  Try again
                </RButton>
                <RButton variant="outline" onClick={() => captureRef.current && downloadCapture(captureRef.current)}>
                  Download video
                </RButton>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--ink-4)", lineHeight: 1.5 }}>
                Your recording is kept safely on this device until it uploads. You can also retry later from the
                Vyooom popup.
              </p>
              <button
                onClick={() => { setError(null); setPhase("idle"); }}
                style={{ marginTop: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--ink-3)" }}
              >
                Back (keeps the recording)
              </button>
            </>
          ) : (
            <RButton variant="outline" style={{ marginTop: 16 }} onClick={() => { setError(null); setPhase("idle"); }}>
              Back
            </RButton>
          )}
        </div>
      )}

      {phase === "recover" && captureRef.current && (
        <div style={{ width: 440, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Unsaved recording</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-3)" }}>
            {captureRef.current.title} · {(captureRef.current.blob.size / (1024 * 1024)).toFixed(1)} MB
            {captureRef.current.durationMs > 0 && <> · {formatDuration(captureRef.current.durationMs / 1000)}</>}
          </p>
          {error && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--danger)" }}>{error}</p>}
          <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 8 }}>
            <RButton variant="primary" onClick={() => void publishCurrentCapture()}>
              Upload now
            </RButton>
            <RButton variant="outline" onClick={() => captureRef.current && downloadCapture(captureRef.current)}>
              Download
            </RButton>
            <RButton variant="outline" onClick={() => void discardCapture()}>
              Discard
            </RButton>
          </div>
          <p style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, margin: "14px 0 0", fontSize: 12, color: "var(--ink-4)" }}>
            Uploads to <StorageBadge provider={ctx.defaultDestination} />
          </p>
        </div>
      )}
    </Centered>
  );
}

/* ---------------- pre-record preview pieces ---------------- */
function chipStyle(on: boolean): React.CSSProperties {
  return {
    minWidth: 28,
    height: 28,
    padding: "0 8px",
    borderRadius: "var(--r-sm)",
    border: "1.5px solid",
    borderColor: on ? "var(--accent)" : "var(--line)",
    background: on ? "var(--accent-soft)" : "var(--surface)",
    color: on ? "var(--accent-ink)" : "var(--ink-3)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "var(--sans)",
  };
}

/** Live circular webcam preview, scaled to reflect the chosen bubble size. */
function CameraPreview({ on, deviceId, size }: { on: boolean; deviceId: string; size: CameraSize }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState(false);
  // preview diameter scales with the chosen bubble size (capped for the panel)
  const px = Math.round(CAMERA_SIZE_PX[size] * 0.85);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    setErr(false);
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (ref.current) {
          ref.current.srcObject = s;
          void ref.current.play().catch(() => {});
        }
      })
      .catch(() => setErr(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [on, deviceId]);

  if (!on) {
    return (
      <div
        style={{
          width: 136,
          height: 136,
          borderRadius: "50%",
          border: "2px dashed var(--line-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: "var(--ink-4)",
        }}
      >
        <Icons.Cam size={26} />
        <span style={{ fontSize: 11 }}>Camera off</span>
      </div>
    );
  }
  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid var(--accent)",
        background: "var(--hud)",
        boxShadow: "var(--e2)",
      }}
    >
      {err ? (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hud-ink-2)", fontSize: 11, textAlign: "center", padding: 8 }}>
          No camera access
        </div>
      ) : (
        <video ref={ref} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
      )}
    </div>
  );
}

/** Live mic input level meter (segmented bar). */
function MicMeter({ on, deviceId }: { on: boolean; deviceId: string }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!on) {
      setLevel(0);
      return;
    }
    let ctx: AudioContext | null = null;
    let raf = 0;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false })
      .then((s) => {
        stream = s;
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 90));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [on, deviceId]);

  const segments = 18;
  const lit = Math.round(level * segments);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 280 }}>
      <Icons.Mic size={15} style={{ color: on ? "var(--ink-2)" : "var(--ink-4)" }} />
      <div style={{ flex: 1, display: "flex", gap: 2, height: 12, alignItems: "center" }}>
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: on ? 6 + (i / segments) * 6 : 4,
              borderRadius: 99,
              background: on && i < lit ? "var(--accent)" : "var(--surface-3)",
              transition: "background 80ms",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CornerPicker({ value, onChange }: { value: CameraCorner; onChange: (c: CameraCorner) => void }) {
  const corners: CameraCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 34, height: 34, padding: 3, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--surface-2)" }}>
      {corners.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            title={c.replace("-", " ")}
            onClick={() => onChange(c)}
            style={{ borderRadius: 3, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--line-2)" }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- pieces ---------------- */
function SettingRow({
  icon: Ico,
  label,
  sub,
  on,
  onToggle,
  showWave,
  divider,
}: {
  icon: typeof Icons.Cam;
  label: string;
  sub: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  showWave?: boolean;
  divider?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: divider ? "1px solid var(--line)" : "none" }}>
      <span style={{ color: on ? "var(--ink)" : "var(--ink-4)" }}>
        <Ico size={19} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{sub}</div>
      </div>
      {showWave && on && <Waveform bars={9} height={16} active color="var(--accent)" width={2} />}
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

function RecDock({
  phase,
  elapsed,
  onStop,
  onToggle,
  onCancel,
}: {
  phase: "recording" | "paused";
  elapsed: number;
  onStop: () => void;
  onToggle: () => void;
  onCancel: () => void;
}) {
  const recording = phase === "recording";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: 8,
        borderRadius: "var(--r-pill)",
        background: "color-mix(in oklch, var(--hud) 92%, transparent)",
        backdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid var(--hud-line)",
        boxShadow: "var(--e-hud)",
      }}
    >
      <button
        onClick={onStop}
        title="Stop & save"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          height: 44,
          padding: "0 16px 0 14px",
          borderRadius: "var(--r-pill)",
          border: "none",
          cursor: "pointer",
          background: "var(--live)",
          color: "oklch(0.2 0.02 262)",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <Icons.Stop size={16} /> Stop
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", color: "var(--hud-ink)" }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            background: recording ? "var(--live)" : "var(--hud-ink-2)",
            boxShadow: recording ? "0 0 10px var(--live)" : "none",
            animation: recording ? "r-live-blink 1.4s steps(1) infinite" : "none",
          }}
        />
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, minWidth: 52 }}>{formatDuration(elapsed / 1000)}</span>
      </div>
      <span style={{ width: 1, height: 26, background: "var(--hud-line)" }} />
      <IconBtn icon={recording ? Icons.Pause : Icons.Play} tone="hud" size={44} onClick={onToggle} title={recording ? "Pause" : "Resume"} />
      <IconBtn icon={Icons.Trash} tone="hud" size={44} onClick={onCancel} title="Discard" />
    </div>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div key={n} style={{ position: "relative", width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center", animation: "r-fade 0.22s ease both" }}>
        <div style={{ position: "absolute", inset: 0, color: "var(--accent)" }}>
          <ReticleMark size={168} sw={1.3} dot={false} color="currentColor" />
        </div>
        <span style={{ fontSize: 78, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.04em" }}>{n}</span>
      </div>
      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>Get ready…</p>
    </div>
  );
}

function Spin() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "2.5px solid var(--line-2)",
        borderTopColor: "var(--accent)",
        animation: "r-spin 0.7s linear infinite",
      }}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "radial-gradient(130% 120% at 50% -10%, var(--surface) 0%, var(--paper) 55%, var(--surface-2) 100%)",
      }}
    >
      {children}
    </div>
  );
}

/** Presenter webcam bubble over the whiteboard (captured by the tab recording). */
function CameraBubble({ deviceId }: { deviceId: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (ref.current) ref.current.srcObject = s;
      })
      .catch(() => {});
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [deviceId]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        height: 152,
        width: 152,
        overflow: "hidden",
        borderRadius: "50%",
        border: "3px solid var(--accent)",
        background: "var(--hud)",
        boxShadow: "var(--e-hud)",
      }}
    >
      <video ref={ref} autoPlay muted playsInline style={{ height: "100%", width: "100%", objectFit: "cover" }} />
    </div>
  );
}
