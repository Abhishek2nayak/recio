/**
 * Edit screen (recording / screenshot) — full-screen editor:
 *   header   back · Editing badge · autosave hint · Share · Done
 *   left     inline-editable title → seekable player (+ overlay editing) →
 *            Trim & smart cleanup → Overlays card (add/edit/remove)
 *   right    tabbed rail — "AI" (summary + clickable transcript) and
 *            "Details" (share link, analytics, workspace, delete)
 * Everything non-destructive; edits autosave (overlays debounced, trim on release).
 */
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import {
  ResourceType,
  formatDuration,
  type AnalyticsDTO,
  type CutSegment,
  type MediaDTO,
  type Overlay,
  type RecordingDTO,
  type TranscriptDTO,
  type WorkspaceDTO,
} from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { vttUrl } from "../lib/vtt.js";
import { useTrimClamp } from "../hooks/useTrimClamp.js";
import { useSkipSegments } from "../hooks/useSkipSegments.js";
import { useDrivePermission } from "../hooks/useDrivePermission.js";
import { SharePanel } from "./SharePanel.js";
import { Logo, OverlayLayer, Player, RButton, Tag, newOverlay } from "./recio/index.js";
import { Icons } from "./recio/icons.js";

const fmtT = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.max(0, Math.round(t % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
};

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
  const { setVisibility } = useDrivePermission();
  const [title, setTitle] = useState(media.title);
  const [isPublic, setIsPublic] = useState(media.isPublic);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const isRecording = media.resourceType === ResourceType.RECORDING;
  const rec = isRecording ? (media as RecordingDTO) : null;

  // Player state wired to the real <video>.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [railTab, setRailTab] = useState<"ai" | "details">(isRecording ? "ai" : "details");

  // Non-destructive trim.
  const [editingTrim, setEditingTrim] = useState(false);
  const [savedTrim, setSavedTrim] = useState<{ start: number | null; end: number | null }>({
    start: rec?.trimStartSec ?? null,
    end: rec?.trimEndSec ?? null,
  });
  useTrimClamp(videoRef, savedTrim.start, savedTrim.end, !editingTrim);

  // Smart cleanup skip ranges.
  const [cuts, setCuts] = useState<CutSegment[] | null>(rec?.cuts ?? null);
  useSkipSegments(videoRef, cuts, !editingTrim);

  // Non-destructive overlays (text / box / blur).
  const [overlays, setOverlays] = useState<Overlay[]>(rec?.overlays ?? []);
  const [selOverlay, setSelOverlay] = useState<string | null>(null);
  const overlaysDirty = useRef(false);
  useEffect(() => {
    if (!overlaysDirty.current) return;
    const t = setTimeout(() => {
      void api.updateRecording(media.id, { overlays: overlays.length ? overlays : null });
    }, 700);
    return () => clearTimeout(t);
  }, [overlays, media.id]);
  function changeOverlays(next: Overlay[]) {
    overlaysDirty.current = true;
    setOverlays(next);
  }
  function addOverlay(type: Overlay["type"]) {
    const time = videoRef.current?.currentTime ?? progress * duration;
    const ov = newOverlay(type, time, duration);
    changeOverlays([...overlays, ov]);
    setSelOverlay(ov.id);
  }
  const selected = overlays.find((o) => o.id === selOverlay) ?? null;

  // Editor keyboard: Delete/Backspace removes the selected overlay, Esc deselects.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") setSelOverlay(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selOverlay) {
        changeOverlays(overlays.filter((o) => o.id !== selOverlay));
        setSelOverlay(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // AI transcript + summary.
  const [transcript, setTranscript] = useState<TranscriptDTO | null | "loading">(isRecording ? "loading" : null);
  useEffect(() => {
    if (!isRecording) return;
    api
      .getTranscript(media.id)
      .then((r) => setTranscript(r.transcript))
      .catch(() => setTranscript(null));
  }, [media.id, isRecording]);

  // Captions track (WebVTT) from the transcript's word timestamps.
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  useEffect(() => {
    const words = transcript && transcript !== "loading" ? transcript.words : null;
    if (!words?.length) return;
    const url = vttUrl(words);
    setCaptionsUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [transcript]);

  // Sync the custom scrub/play button with the real media element.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => v.duration && setProgress(v.currentTime / v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [playbackUrl]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  async function commitTitle() {
    const next = title.trim();
    if (next && next !== media.title) await onRename(next);
    else setTitle(media.title);
  }

  async function saveTrim(start: number | null, end: number | null) {
    await api.updateRecording(media.id, { trimStartSec: start, trimEndSec: end });
    setSavedTrim({ start, end });
    setEditingTrim(false);
  }

  async function confirmDelete() {
    setDeleting(true);
    await onDelete();
    navigate("/dashboard");
  }

  async function share() {
    if (!isPublic) {
      setIsPublic(true);
      const ok = await setVisibility(media.shareToken, true);
      if (!ok) setIsPublic(false);
    }
    await navigator.clipboard.writeText(`${config.apiBaseUrl}/s/${media.shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const duration = rec?.duration ?? 0;
  const viewHref = `${isRecording ? "/recordings" : "/screenshots"}/${media.id}`;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      {/* header */}
      <header
        style={{
          height: 60,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 20px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <button
          onClick={() => navigate(viewHref)}
          title="Back to the video"
          style={{ display: "inline-flex", alignItems: "center", gap: 10, border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "var(--ink-3)" }}
        >
          <Icons.ChevD size={18} style={{ transform: "rotate(90deg)" }} />
          <Logo size={22} />
        </button>
        <span style={{ width: 1, height: 22, background: "var(--line-2)" }} />
        <Tag tone="accent">
          <Icons.Bolt size={12} /> Editing
        </Tag>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
            Saved automatically · edits never touch the original file
          </span>
          <RButton variant="outline" size="sm" icon={copied ? Icons.Check : Icons.Share} onClick={share}>
            {copied ? "Link copied" : "Share"}
          </RButton>
          <RButton variant="primary" size="sm" icon={Icons.Check} onClick={() => navigate(viewHref)}>
            Done
          </RButton>
        </div>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 332px", minHeight: 0 }}>
        {/* editor */}
        <div className="r-scroll" style={{ overflow: "auto", padding: "26px 28px" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--sans)",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginBottom: 16,
              padding: 0,
            }}
          />

          {isRecording ? (
            <div style={{ position: "relative" }}>
              <Player
                ref={videoRef}
                src={playbackUrl}
                progress={progress}
                playing={playing}
                onToggle={togglePlay}
                onSeek={(f) => {
                  const v = videoRef.current;
                  if (v && duration) v.currentTime = f * duration;
                }}
                dur={duration}
                big
                captionsUrl={captionsUrl}
              />
              <OverlayLayer
                overlays={overlays}
                time={progress * duration}
                editable
                selectedId={selOverlay}
                onSelect={setSelOverlay}
                onChange={changeOverlays}
              />
            </div>
          ) : (
            <div
              style={{
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                border: "1px solid var(--line)",
                background: "var(--hud)",
                boxShadow: "var(--e3)",
              }}
            >
              <img src={playbackUrl} alt={title} style={{ display: "block", width: "100%", maxHeight: "70vh", objectFit: "contain" }} />
            </div>
          )}

          {rec && rec.duration > 0 && (
            <TrimCard
              duration={rec.duration}
              videoRef={videoRef}
              progress={progress}
              saved={savedTrim}
              onEditingChange={setEditingTrim}
              onSave={(s, e) => void saveTrim(s, e)}
              recordingId={media.id}
              cuts={cuts}
              onCuts={setCuts}
            />
          )}

          {isRecording && (
            <div
              style={{
                marginTop: 14,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-lg)",
                padding: 16,
                boxShadow: "var(--e1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: selected ? 12 : 0 }}>
                <Icons.Plus size={16} style={{ color: "var(--ink-2)" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Overlays</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                  {overlays.length
                    ? `${overlays.length} on this video — click one to edit`
                    : "label, highlight, or blur part of the frame"}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <RButton variant="soft" size="sm" icon={Icons.Plus} onClick={() => addOverlay("text")}>Text</RButton>
                  <RButton variant="soft" size="sm" icon={Icons.Plus} onClick={() => addOverlay("rect")}>Box</RButton>
                  <RButton variant="soft" size="sm" icon={Icons.Blur} onClick={() => addOverlay("blur")}>Blur</RButton>
                </div>
              </div>
              {selected && (
                <OverlayProps
                  overlay={selected}
                  duration={duration}
                  onChange={(patch) => changeOverlays(overlays.map((o) => (o.id === selected.id ? { ...o, ...patch } : o)))}
                  onDelete={() => {
                    changeOverlays(overlays.filter((o) => o.id !== selected.id));
                    setSelOverlay(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* side panel — tabbed so share/analytics/workspace are one click away */}
        <aside
          className="r-scroll"
          style={{
            borderLeft: "1px solid var(--line)",
            background: "var(--surface)",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid var(--line)", padding: "0 12px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 2 }}>
            {(
              [
                ["ai", "AI", Icons.Bolt],
                ["details", "Details", Icons.Gear],
              ] as const
            ).map(([key, label, Ico]) => {
              const on = railTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setRailTab(key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "13px 12px 11px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    fontWeight: on ? 700 : 500,
                    color: on ? "var(--ink)" : "var(--ink-3)",
                    borderBottom: "2px solid",
                    borderBottomColor: on ? "var(--accent)" : "transparent",
                  }}
                >
                  <Ico size={14} />
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {railTab === "ai" ? (
              <>
                <AutoSummary transcript={transcript} recordingId={media.id} isRecording={isRecording} onChange={setTranscript} />
                {isRecording && (
                  <TranscriptList
                    transcript={transcript}
                    duration={duration}
                    onSeek={(t) => {
                      const v = videoRef.current;
                      if (v) {
                        v.currentTime = t;
                        void v.play();
                      }
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <SharePanel shareToken={media.shareToken} isPublic={isPublic} provider={media.storageProvider} onChange={setIsPublic} />
                <AnalyticsPanel mediaId={media.id} />
                <MoveToWorkspace media={media} />
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
                  <span className="flex items-center gap-2 text-xs text-muted">Stored in your cloud</span>
                  <DeleteDialog deleting={deleting} onConfirm={confirmDelete} />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Section header ---------------- */
function SectionHead({ icon: Ico, title, badge }: { icon: typeof Icons.Bolt; title: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
      <Ico size={16} style={{ color: "var(--ink-2)" }} />
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
      {badge && (
        <Tag tone="accent" style={{ marginLeft: "auto", height: 19, fontSize: 10 }}>
          {badge}
        </Tag>
      )}
    </div>
  );
}

/* ---------------- Auto summary ---------------- */
function AutoSummary({
  transcript,
  recordingId,
  isRecording,
  onChange,
}: {
  transcript: TranscriptDTO | null | "loading";
  recordingId: string;
  isRecording: boolean;
  onChange: (t: TranscriptDTO) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ready = transcript && transcript !== "loading" && transcript.status === "READY";
  const summary = ready ? (transcript as TranscriptDTO).summary : null;

  async function generate() {
    setBusy(true);
    try {
      const r = await api.generateTranscript(recordingId);
      onChange(r.transcript);
    } catch {
      /* upsell modal handles 402 */
    } finally {
      setBusy(false);
    }
  }

  const tags = summary
    ? Array.from(new Set(summary.toLowerCase().match(/[a-z]{5,}/g) ?? []))
        .filter((w) => !["about", "which", "their", "there", "these", "those", "would", "could"].includes(w))
        .slice(0, 3)
    : [];

  return (
    <div>
      <SectionHead icon={Icons.Bolt} title="Auto summary" badge="AI" />
      {!isRecording ? (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-3)" }}>Screenshots don't have a summary.</p>
      ) : transcript === "loading" ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-4)" }}>Loading…</p>
      ) : summary ? (
        <>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>{summary}</p>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {tags.map((t) => (
                <Tag key={t}>#{t}</Tag>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-3)" }}>
            Generate an AI summary, title, and searchable transcript for this recording.
          </p>
          <RButton variant="soft" size="sm" icon={Icons.Bolt} onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </RButton>
        </>
      )}
    </div>
  );
}

/* ---------------- Transcript (click a line to jump there) ---------------- */
interface TLine {
  at: number | null; // real start (seconds) when word timings exist
  text: string;
}

function transcriptLines(t: TranscriptDTO): TLine[] {
  // Preferred: word-level timestamps → real, clickable line starts.
  if (t.words?.length) {
    const lines: TLine[] = [];
    let group: typeof t.words = [];
    const flush = () => {
      if (!group.length) return;
      lines.push({ at: group[0]!.start, text: group.map((w) => w.word).join(" ") });
      group = [];
    };
    for (const w of t.words) {
      group.push(w);
      const sentenceEnd = /[.?!]$/.test(w.word);
      if (sentenceEnd || group.length >= 24) flush();
    }
    flush();
    return lines.slice(0, 80);
  }
  // Fallback: plain text split (no timings → not clickable).
  return (t.text ?? "")
    .split(/(?<=[.?!])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((text) => ({ at: null, text }));
}

function TranscriptList({
  transcript,
  duration,
  onSeek,
}: {
  transcript: TranscriptDTO | null | "loading";
  duration: number;
  onSeek?: (seconds: number) => void;
}) {
  const ready = transcript && transcript !== "loading" && transcript.status === "READY";
  const lang = ready ? (transcript as TranscriptDTO).language : null;
  const lines = ready ? transcriptLines(transcript as TranscriptDTO) : [];

  return (
    <div>
      <SectionHead icon={Icons.Comment} title="Transcript" badge={lang ? lang.toUpperCase().slice(0, 2) : undefined} />
      {transcript === "loading" ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-4)" }}>Loading…</p>
      ) : lines.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-4)" }}>No transcript yet — generate one above.</p>
      ) : (
        lines.map((line, i) => {
          const at = line.at ?? (duration ? (i / lines.length) * duration : 0);
          const clickable = Boolean(onSeek);
          return (
            <div
              key={i}
              onClick={clickable ? () => onSeek!(at) : undefined}
              title={clickable ? "Jump to this moment" : undefined}
              style={{
                display: "flex",
                gap: 10,
                padding: "8px 6px",
                margin: "0 -6px",
                borderTop: i ? "1px solid var(--line)" : "none",
                borderRadius: 6,
                cursor: clickable ? "pointer" : "default",
              }}
              onMouseEnter={(e) => clickable && (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="mono" style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 600, flexShrink: 0, paddingTop: 1 }}>
                {fmtT(at)}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>{line.text}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ---------------- Trim card (handoff waveform look, real drag) ---------------- */
function TrimCard({
  duration,
  videoRef,
  progress,
  saved,
  onEditingChange,
  onSave,
  recordingId,
  cuts,
  onCuts,
}: {
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  progress: number;
  saved: { start: number | null; end: number | null };
  onEditingChange: (v: boolean) => void;
  onSave: (start: number | null, end: number | null) => void;
  recordingId: string;
  cuts: CutSegment[] | null;
  onCuts: (c: CutSegment[] | null) => void;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState(saved.start ?? 0);
  const [end, setEnd] = useState(saved.end ?? duration);
  const [cleaning, setCleaning] = useState(false);

  const startPct = (start / duration) * 100;
  const endPct = (end / duration) * 100;

  function timeFromX(clientX: number): number {
    const bar = barRef.current;
    if (!bar) return 0;
    const r = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
  }

  function drag(which: "start" | "end") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      onEditingChange(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const t = timeFromX(ev.clientX);
        if (which === "start") {
          const next = Math.max(0, Math.min(t, end - 0.5));
          setStart(next);
          if (videoRef.current) videoRef.current.currentTime = next;
        } else {
          const next = Math.min(duration, Math.max(t, start + 0.5));
          setEnd(next);
          if (videoRef.current) videoRef.current.currentTime = next;
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        onSave(start === 0 ? null : start, end >= duration ? null : end);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }

  async function removeSilences() {
    setCleaning(true);
    try {
      const { cleanup } = await api.runCleanup(recordingId);
      onCuts(cleanup.cuts);
    } catch {
      /* upsell handles 402 */
    } finally {
      setCleaning(false);
    }
  }

  const kept = Math.max(0, end - start);

  return (
    <div
      style={{
        marginTop: 20,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 16,
        boxShadow: "var(--e1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
        <Icons.Trim size={17} style={{ color: "var(--ink-2)" }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Trim</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>
          {fmtT(kept)} kept{cuts && cuts.length ? ` · ${cuts.length} cut${cuts.length === 1 ? "" : "s"}` : ""}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <RButton variant="soft" size="sm" icon={Icons.Speed} onClick={removeSilences} disabled={cleaning}>
            {cleaning ? "Cleaning…" : "Remove silences"}
          </RButton>
        </div>
      </div>
      <div ref={barRef} style={{ position: "relative", height: 52, borderRadius: 10, background: "var(--hud)", overflow: "hidden", userSelect: "none" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 2.5, padding: "0 4px" }}>
          {Array.from({ length: 64 }).map((_, i) => (
            <span key={i} style={{ flex: 1, height: `${24 + Math.abs(Math.sin(i * 0.7)) * 22}px`, background: "rgba(255,255,255,.18)", borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${startPct}%`, background: "oklch(0.16 0.01 262 / 0.7)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${100 - endPct}%`, background: "oklch(0.16 0.01 262 / 0.7)" }} />
        {([["start", startPct], ["end", endPct]] as const).map(([which, pct]) => (
          <div
            key={which}
            onPointerDown={drag(which)}
            style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${pct}% - 6px)`, width: 12, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
          >
            <span style={{ width: 6, height: "100%", background: "var(--accent)", borderRadius: 4, boxShadow: "var(--e1)" }} />
          </div>
        ))}
        <div style={{ position: "absolute", top: -2, bottom: -2, left: `${progress * 100}%`, width: 2, background: "white", boxShadow: "0 0 8px rgba(0,0,0,.5)" }} />
      </div>
    </div>
  );
}

/* ---------------- Selected overlay properties ---------------- */
function OverlayProps({
  overlay,
  duration,
  onChange,
  onDelete,
}: {
  overlay: Overlay;
  duration: number;
  onChange: (patch: Partial<Overlay>) => void;
  onDelete: () => void;
}) {
  const swatches = ["#2563EB", "#FF5C5C", "#FFD23F", "#7C5CFF", "#22C55E", "#1D1D1F"];
  const label = overlay.type === "text" ? "Text" : overlay.type === "blur" ? "Blur" : "Box";
  return (
    <div style={{ marginTop: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 14, boxShadow: "var(--e1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{label} overlay</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>drag to move · corner to resize</span>
        <div style={{ marginLeft: "auto" }}>
          <RButton variant="ghost" size="sm" icon={Icons.Trash} onClick={onDelete}>
            Remove
          </RButton>
        </div>
      </div>

      {overlay.type === "text" && (
        <input
          value={overlay.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Overlay text"
          style={{ width: "100%", height: 36, borderRadius: "var(--r)", border: "1px solid var(--line-2)", background: "var(--surface)", padding: "0 12px", fontSize: 13.5, outline: "none", fontFamily: "var(--sans)", marginBottom: 12 }}
        />
      )}

      {overlay.type !== "blur" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Color</span>
          {swatches.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              style={{ width: 22, height: 22, borderRadius: 6, background: c, border: overlay.color === c ? "2px solid var(--ink)" : "1px solid var(--line)", cursor: "pointer" }}
            />
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Shows</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
          from
          <input
            type="number"
            min={0}
            max={duration}
            step={0.5}
            value={Math.round(overlay.startSec * 10) / 10}
            onChange={(e) => onChange({ startSec: Math.min(overlay.endSec, Math.max(0, Number(e.target.value))) })}
            className="mono"
            style={timeInput}
          />
          s
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
          to
          <input
            type="number"
            min={0}
            max={duration}
            step={0.5}
            value={Math.round(overlay.endSec * 10) / 10}
            onChange={(e) => onChange({ endSec: Math.max(overlay.startSec, Math.min(duration, Number(e.target.value))) })}
            className="mono"
            style={timeInput}
          />
          s
        </label>
      </div>
    </div>
  );
}

const timeInput: React.CSSProperties = {
  width: 64,
  height: 30,
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--line-2)",
  background: "var(--surface-2)",
  padding: "0 8px",
  fontSize: 12,
  outline: "none",
  color: "var(--ink)",
};

/* ── reused functional panels (Tailwind, auto-themed) ───────────────────────── */
function AnalyticsPanel({ mediaId }: { mediaId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsDTO | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.getAnalytics(mediaId).then((d) => !cancelled && setData(d)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  const retention = data?.pro
    ? data.pro.dropOff.map((_, k) => data.pro!.dropOff.slice(k).reduce((s, n) => s + n, 0))
    : [];
  const denom = Math.max(1, data?.views ?? 1);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Analytics</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Views" value={data ? data.views : "—"} />
        <Stat label="Unique viewers" value={data ? data.uniqueViewers : "—"} />
      </div>
      {data?.pro ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Avg watched</span>
            <span className="font-medium text-text-primary">{data.pro.avgWatchedPct}%</span>
          </div>
          <p className="mb-1.5 mt-3 text-[11px] text-muted">Viewer retention</p>
          <div className="flex h-20 items-end gap-1">
            {retention.map((count, i) => (
              <div key={i} className="flex-1 rounded-t bg-highlight" style={{ height: `${Math.max(3, (count / denom) * 100)}%` }} />
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate("/pricing")}
          className="mt-4 w-full rounded-lg bg-highlight/15 px-3 py-2 text-xs font-medium text-text-primary ring-1 ring-highlight/40 transition-colors hover:bg-highlight/25"
        >
          Unlock watch-through & retention with Pro →
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-bg-primary px-3 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function MoveToWorkspace({ media }: { media: MediaDTO }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[] | null>(null);
  const [current, setCurrent] = useState<string>(media.workspaceId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listWorkspaces().then((r) => setWorkspaces(r.workspaces)).catch(() => setWorkspaces([]));
  }, []);

  if (!workspaces || workspaces.length === 0) return null;

  async function move(value: string) {
    setCurrent(value);
    setSaving(true);
    const body = { workspaceId: value || null };
    try {
      if (media.resourceType === ResourceType.RECORDING) await api.updateRecording(media.id, body);
      else await api.updateScreenshot(media.id, body);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Workspace</h3>
      <select
        value={current}
        disabled={saving}
        onChange={(e) => void move(e.target.value)}
        className="mt-2 w-full rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="">Personal (only you)</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DeleteDialog({ deleting, onConfirm }: { deleting: boolean; onConfirm: () => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/20">
          <Icons.Trash size={14} /> Delete
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-xl focus:outline-none">
          <Dialog.Title className="text-base font-semibold">Delete this item?</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted">
            This removes it from your library and deletes the file from your storage. This can't be undone.
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-md px-3 py-2 text-sm text-muted hover:text-text-primary">Cancel</button>
            </Dialog.Close>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="rounded-md bg-danger px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

