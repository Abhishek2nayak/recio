/**
 * Whiteboard page. Mounts our in-house canvas (WhiteboardCanvas — pen/shapes/text/
 * eraser, no third-party dependency) filling the main area. A bottom recorder dock
 * captures the screen (the browser picker lets you choose a tab, window, or the whole
 * screen) and saves the result; the public `/whiteboard/embed` route stays chrome-less
 * for the extension studio to embed.
 */
import { useEffect, useRef, useState } from "react";
import { StorageProvider } from "@flowcap/shared";
import { WhiteboardCanvas } from "../components/WhiteboardCanvas.js";
import { api } from "../lib/api.js";
import { publishWebRecording } from "../lib/webPublish.js";
import { useAuthStore } from "../stores/authStore.js";
import { StorageBadge } from "../components/ui.js";
import { Icons, IconBtn, RButton } from "../components/recio/index.js";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

type Phase = "idle" | "recording" | "paused";

export function Whiteboard() {
  const embed =
    window.location.pathname.endsWith("/whiteboard/embed") ||
    new URLSearchParams(window.location.search).has("embed");

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Loom-style review: the finished take, waiting on Save / Download / Discard.
  const [review, setReview] = useState<{ blob: Blob; durationMs: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const pauseStartRef = useRef(0);
  const discardRef = useRef(false);

  // Live timer while recording.
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed((startedRef.current ? (Date.now() - startedRef.current - pausedAccumRef.current) : 0) / 1000), 250);
    return () => clearInterval(t);
  }, [phase]);

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  function finalize() {
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "video/webm" });
    const durationMs = startedRef.current ? Date.now() - startedRef.current - pausedAccumRef.current : 0;
    cleanup();
    setPhase("idle");
    setElapsed(0);
    if (discardRef.current || blob.size === 0) return;
    // Don't download-and-forget: open the review modal (preview → save to cloud).
    setReview({ blob, durationMs });
  }

  async function startRecording() {
    setError(null);
    discardRef.current = false;
    try {
      // No surface restriction → the browser picker offers tab / window / screen.
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = finalize;
      // Stopping the share from the browser chrome ends the recording too.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (rec.state !== "inactive") rec.stop();
      });
      rec.start(1000);
      startedRef.current = Date.now();
      pausedAccumRef.current = 0;
      setElapsed(0);
      setPhase("recording");
    } catch (err) {
      if (err instanceof DOMException && /denied|abort|not allowed/i.test(err.message)) return; // user cancelled picker
      setError(err instanceof Error ? err.message : "Couldn't start recording.");
    }
  }

  function pause() {
    recorderRef.current?.pause();
    pauseStartRef.current = Date.now();
    setPhase("paused");
  }
  function resume() {
    recorderRef.current?.resume();
    pausedAccumRef.current += Date.now() - pauseStartRef.current;
    setPhase("recording");
  }
  function stop() {
    discardRef.current = false;
    recorderRef.current?.stop();
  }
  function discard() {
    discardRef.current = true;
    recorderRef.current?.stop();
  }

  if (embed) {
    return (
      <div className="relative h-screen w-screen">
        <WhiteboardCanvas theme="light" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--paper)" }}>
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Whiteboard</p>
          <h1 className="text-lg font-semibold tracking-tight">Draw it out</h1>
        </div>
        {phase === "idle" && (
          <RButton variant="primary" icon={Icons.Reticle} onClick={startRecording}>
            Record
          </RButton>
        )}
        {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
      </div>

      <div className="relative min-h-0 flex-1">
        <WhiteboardCanvas theme="light" />

        {/* bottom recorder dock */}
        {phase !== "idle" && (
          <div style={{ position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 5 }}>
            <RecDock phase={phase} elapsed={elapsed} onStop={stop} onToggle={phase === "recording" ? pause : resume} onDiscard={discard} />
          </div>
        )}
      </div>

      {review && <ReviewModal blob={review.blob} durationMs={review.durationMs} onClose={() => setReview(null)} />}
    </div>
  );
}

/** Review & save — preview the take, rename it, then send it to the user's cloud
 *  (instant link: the share URL appears while the upload still runs). */
function ReviewModal({ blob, durationMs, onClose }: { blob: Blob; durationMs: number; onClose: () => void }) {
  const hostedStorage = useAuthStore((st) => st.user?.entitlements?.hostedStorage ?? false);
  const [title, setTitle] = useState(
    `Whiteboard — ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  );
  const [destination, setDestination] = useState<StorageProvider>(StorageProvider.FLOWCAP);
  const [previewUrl] = useState(() => URL.createObjectURL(blob));
  const [state, setState] = useState<"review" | "saving" | "done" | "error">("review");
  const [progress, setProgress] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.storageStatus().then((st) => setDestination(st.defaultProvider)).catch(() => {});
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function save() {
    setState("saving");
    setErr(null);
    try {
      await publishWebRecording({
        blob,
        title: title.trim() || "Whiteboard recording",
        durationMs,
        destination,
        onLinkReady: (url, id) => {
          setShareUrl(url);
          setMediaId(id);
          void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {});
        },
        onProgress: setProgress,
      });
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Saving failed.");
      setState("error");
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "whiteboard"}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function discardTake() {
    if (state === "saving") return;
    if (window.confirm("Discard this recording? It hasn't been saved anywhere.")) onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,12,16,.55)",
        backdropFilter: "blur(6px)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 640,
          maxWidth: "100%",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--e3)",
          padding: 20,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {state === "done" ? "Saved to your cloud" : "Review your recording"}
        </h2>

        <video src={previewUrl} controls style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--r)", background: "var(--hud)", objectFit: "contain" }} />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={state === "saving" || state === "done"}
          style={{
            width: "100%",
            marginTop: 12,
            height: 40,
            borderRadius: "var(--r)",
            border: "1px solid var(--line-2)",
            background: "var(--surface-2)",
            padding: "0 12px",
            fontFamily: "var(--sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            outline: "none",
          }}
        />

        <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
          Saves to <StorageBadge provider={destination} />
        </p>
        {destination === StorageProvider.FLOWCAP && !hostedStorage && (
          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--warning)" }}>
            <strong>Vyooom Cloud needs Premium.</strong> Connect Google Drive or Dropbox in{" "}
            <a href="/settings" style={{ color: "var(--accent-ink)" }}>Settings</a> to save free with your own
            storage — or download the file below.
          </p>
        )}

        {(state === "saving" || state === "done") && (
          <div style={{ marginTop: 12 }}>
            {shareUrl && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mono"
                  style={{ flex: 1, minWidth: 0, height: 38, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface-2)", padding: "0 12px", fontSize: 12, color: "var(--ink-2)", outline: "none" }}
                />
                <RButton
                  variant={copied ? "primary" : "dark"}
                  size="md"
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
            )}
            <div style={{ height: 7, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "var(--accent)", borderRadius: 99, transition: "width 200ms" }} />
            </div>
            <p className="mono" style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--ink-4)" }}>
              {state === "done" ? "Upload complete" : `Uploading… ${Math.round(progress * 100)}% — your link already works`}
            </p>
          </div>
        )}

        {err && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--danger)" }}>{err}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          {state === "done" ? (
            <>
              {mediaId && (
                <a href={`/recordings/${mediaId}`} style={{ textDecoration: "none" }}>
                  <RButton variant="primary">Open in library</RButton>
                </a>
              )}
              <RButton variant="outline" onClick={onClose}>Close</RButton>
            </>
          ) : (
            <>
              <RButton variant="outline" onClick={discardTake} disabled={state === "saving"}>Discard</RButton>
              <RButton variant="outline" icon={Icons.Download} onClick={download}>Download</RButton>
              <RButton variant="primary" onClick={save} disabled={state === "saving"}>
                {state === "saving" ? "Saving…" : state === "error" ? "Retry save" : "Save to cloud"}
              </RButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RecDock({
  phase,
  elapsed,
  onStop,
  onToggle,
  onDiscard,
}: {
  phase: Phase;
  elapsed: number;
  onStop: () => void;
  onToggle: () => void;
  onDiscard: () => void;
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
        background: "color-mix(in oklch, var(--hud) 90%, transparent)",
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
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, minWidth: 52 }}>
          {fmt(elapsed)}
        </span>
      </div>
      <span style={{ width: 1, height: 26, background: "var(--hud-line)" }} />
      <IconBtn icon={recording ? Icons.Pause : Icons.Play} tone="hud" size={44} onClick={onToggle} title={recording ? "Pause" : "Resume"} />
      <IconBtn icon={Icons.Trash} tone="hud" size={44} onClick={onDiscard} title="Discard" />
    </div>
  );
}
