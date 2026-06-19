/**
 * Vyooom's own video player — replaces the browser's native controls so the
 * timeline can carry the conversation, Loom-style:
 *
 *   · comment markers on the seek bar (click → jump to that moment)
 *   · timestamped emoji reaction bursts along the timeline
 *   · a live reaction bar that posts an emoji AT the current moment
 *   · speed, captions (CC), volume, ±10s, fullscreen, keyboard shortcuts
 *
 * Dumb on purpose: parents own the data (comments / reactions / captions URL)
 * and the network; this renders and reports. The forwarded ref exposes the raw
 * <video> so existing hooks (trim clamp, skip segments, view tracking) keep
 * working unchanged.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { TimedReaction } from "@flowcap/shared";
import { Icons } from "../recio/icons.js";

export interface TimelineComment {
  timestampSec: number;
  author: string;
  preview: string;
}

export interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  captionsUrl?: string | null;
  /** Fallback duration (seconds) for webm whose metadata reports Infinity. */
  durationHint?: number;
  comments?: TimelineComment[];
  reactions?: TimedReaction[];
  /** Shown as the live reaction bar; omit (with onReact) to hide it. */
  reactionEmojis?: readonly string[];
  onReact?: (emoji: string, atSec: number) => void;
  onTimeUpdate?: (seconds: number) => void;
  autoPlay?: boolean;
  style?: CSSProperties;
}

const SPEEDS = [1, 1.25, 1.5, 2];

const fmt = (t: number): string => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

interface FloatingEmoji {
  id: number;
  emoji: string;
  left: number; // % across the player
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer(
  {
    src,
    poster,
    captionsUrl,
    durationHint,
    comments = [],
    reactions = [],
    reactionEmojis,
    onReact,
    onTimeUpdate,
    autoPlay,
    style,
  },
  forwardedRef,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [cc, setCc] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [floats, setFloats] = useState<FloatingEmoji[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatId = useRef(0);

  const dur = duration > 0 && Number.isFinite(duration) ? duration : durationHint ?? 0;

  // ── video element events ──
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setTime(v.currentTime);
      onTimeUpdate?.(v.currentTime);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onMeta = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [onTimeUpdate, src]);

  // Captions on/off → drive the text track directly.
  useEffect(() => {
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    for (const t of Array.from(tracks)) t.mode = cc ? "showing" : "hidden";
  }, [cc, captionsUrl, src]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Auto-hide the controls while playing.
  const poke = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2600);
  }, []);
  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      return;
    }
    poke();
  }, [playing, poke]);

  // ── actions ──
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !dur) return;
      v.currentTime = Math.min(Math.max(0, t), dur);
      setTime(v.currentTime);
    },
    [dur],
  );

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime + delta);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen();
  }

  function react(emoji: string) {
    const at = videoRef.current?.currentTime ?? 0;
    onReact?.(emoji, at);
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, emoji, left: 8 + Math.random() * 16 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
  }

  // ── seek bar interactions ──
  const barFraction = (clientX: number): number => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  function onBarPointerDown(e: React.PointerEvent) {
    if (!dur) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekTo(barFraction(e.clientX) * dur);
  }
  function onBarPointerMove(e: React.PointerEvent) {
    if (scrubbing && dur) seekTo(barFraction(e.clientX) * dur);
  }
  function onBarPointerUp() {
    setScrubbing(false);
  }

  // ── keyboard ──
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        toggle();
        break;
      case "ArrowLeft":
        skip(-5);
        break;
      case "ArrowRight":
        skip(5);
        break;
      case "m":
        setMuted((v) => !v);
        break;
      case "c":
        if (captionsUrl) setCc((v) => !v);
        break;
      case "f":
        toggleFullscreen();
        break;
    }
  }

  // Cluster timeline reactions into ~2%-wide buckets so bursts stack like Loom.
  const buckets = new Map<number, { emoji: string; count: number; at: number }>();
  if (dur > 0) {
    for (const r of reactions) {
      const key = Math.round((r.timestampSec / dur) * 50);
      const b = buckets.get(key);
      if (b) b.count += 1;
      else buckets.set(key, { emoji: r.emoji, count: 1, at: r.timestampSec });
    }
  }

  const pct = dur ? (time / dur) * 100 : 0;
  const bufferedPct = dur ? Math.min(100, (buffered / dur) * 100) : 0;
  const controlsVisible = showControls || !playing || scrubbing;

  const btn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "white",
    cursor: "pointer",
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={poke}
      onMouseLeave={() => playing && setShowControls(false)}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--hud)",
        outline: "none",
        cursor: controlsVisible ? "default" : "none",
        ...style,
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        playsInline
        muted={muted}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
      >
        {captionsUrl && <track kind="captions" srcLang="en" label="Captions" src={captionsUrl} />}
      </video>

      {/* big center play button when paused */}
      {!playing && (
        <button
          onClick={toggle}
          aria-label="Play"
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "rgba(255,255,255,.92)",
            color: "var(--ink, #111)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 24px rgba(0,0,0,.35)",
          }}
        >
          <Icons.Play size={24} style={{ marginLeft: 3 }} />
        </button>
      )}

      {/* floating reaction animation */}
      {floats.map((f) => (
        <span
          key={f.id}
          style={{
            position: "absolute",
            left: `${f.left}%`,
            bottom: 86,
            fontSize: 26,
            pointerEvents: "none",
            animation: "vp-float 1.4s ease-out forwards",
          }}
        >
          {f.emoji}
        </span>
      ))}

      {/* control surface */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "26px 14px 10px",
          background: "linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.32) 60%, transparent)",
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 180ms ease",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        {/* reaction bursts above the bar */}
        {dur > 0 && buckets.size > 0 && (
          <div style={{ position: "relative", height: 20, marginBottom: 2 }}>
            {[...buckets.values()].map((b, i) => (
              <button
                key={i}
                onClick={() => seekTo(b.at)}
                title={`${b.emoji} ×${b.count} at ${fmt(b.at)}`}
                style={{
                  position: "absolute",
                  left: `${(b.at / dur) * 100}%`,
                  transform: "translateX(-50%)",
                  border: "none",
                  background: "rgba(0,0,0,.45)",
                  borderRadius: 99,
                  padding: "0 5px",
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  fontSize: 11,
                  color: "white",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: 12 }}>{b.emoji}</span>
                {b.count > 1 && <span className="mono">{b.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* seek bar */}
        <div
          ref={barRef}
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          style={{ position: "relative", height: 18, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
        >
          <div style={{ position: "relative", width: "100%", height: 5, borderRadius: 99, background: "rgba(255,255,255,.22)" }}>
            <div style={{ position: "absolute", inset: 0, width: `${bufferedPct}%`, borderRadius: 99, background: "rgba(255,255,255,.18)" }} />
            <div style={{ position: "absolute", insetBlock: 0, left: 0, width: `${pct}%`, borderRadius: 99, background: "var(--accent, #38C6DD)" }} />
            {/* comment markers */}
            {dur > 0 &&
              comments
                .filter((c) => c.timestampSec >= 0 && c.timestampSec <= dur)
                .map((c, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(c.timestampSec);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title={`${c.author} · ${fmt(c.timestampSec)} — ${c.preview}`}
                    style={{
                      position: "absolute",
                      left: `${(c.timestampSec / dur) * 100}%`,
                      top: "50%",
                      transform: "translate(-50%,-50%)",
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      border: "1.5px solid rgba(0,0,0,.4)",
                      background: "white",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
            <span
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 13,
                height: 13,
                borderRadius: 99,
                background: "white",
                boxShadow: "0 1px 4px rgba(0,0,0,.4)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <button style={btn} onClick={toggle} title={playing ? "Pause (k)" : "Play (k)"}>
            {playing ? <Icons.Pause size={18} /> : <Icons.Play size={18} />}
          </button>
          <button style={btn} onClick={() => skip(-10)} title="Back 10s">
            <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>-10</span>
          </button>
          <button style={btn} onClick={() => skip(10)} title="Forward 10s">
            <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>+10</span>
          </button>
          <span className="mono" style={{ fontSize: 12, color: "rgba(255,255,255,.85)", margin: "0 6px" }}>
            {fmt(time)} <span style={{ color: "rgba(255,255,255,.45)" }}>/ {fmt(dur)}</span>
          </span>

          {/* live reactions — land on the timeline at the current moment */}
          {onReact && reactionEmojis && (
            <span
              style={{
                display: "inline-flex",
                gap: 2,
                marginLeft: 4,
                padding: "2px 6px",
                borderRadius: 99,
                background: "rgba(255,255,255,.12)",
              }}
            >
              {reactionEmojis.map((e) => (
                <button
                  key={e}
                  onClick={() => react(e)}
                  title={`React ${e} at ${fmt(time)}`}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 15,
                    cursor: "pointer",
                    padding: "2px 3px",
                    lineHeight: 1,
                  }}
                >
                  {e}
                </button>
              ))}
            </span>
          )}

          <span style={{ flex: 1 }} />

          {captionsUrl && (
            <button
              style={{ ...btn, width: "auto", padding: "0 8px", background: cc ? "rgba(255,255,255,.22)" : "transparent" }}
              onClick={() => setCc((v) => !v)}
              title="Captions (c)"
            >
              <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>CC</span>
            </button>
          )}
          <button
            style={{ ...btn, width: "auto", padding: "0 8px" }}
            onClick={() => setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length] ?? 1)}
            title="Playback speed"
          >
            <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{rate}×</span>
          </button>
          <button
            style={btn}
            onClick={() => setMuted((m) => !m)}
            title="Mute (m)"
          >
            <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{muted || volume === 0 ? "🔇" : "🔊"}</span>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (videoRef.current) {
                videoRef.current.volume = v;
                videoRef.current.muted = v === 0;
              }
            }}
            style={{ width: 64, accentColor: "var(--accent, #38C6DD)" }}
            title="Volume"
          />
          <button style={btn} onClick={toggleFullscreen} title="Fullscreen (f)">
            <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{fullscreen ? "⤡" : "⤢"}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
