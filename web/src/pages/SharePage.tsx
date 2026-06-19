/** Public share viewer at /s/:token — no auth. The Vyooom "Share" screen: player +
 *  title/author/views + reaction chips + comments, with a right rail carrying the
 *  share link card and the signature "Stored in your cloud" card. */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  REACTION_EMOJIS,
  ResourceType,
  formatDuration,
  type PublicShareViewDTO,
  type TimedReaction,
} from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { vttUrl } from "../lib/vtt.js";
import { VideoPlayer, type TimelineComment } from "../components/VideoPlayer/VideoPlayer.js";
import { useViewTracker } from "../hooks/useViewTracker.js";
import { useTrimClamp } from "../hooks/useTrimClamp.js";
import { useSkipSegments } from "../hooks/useSkipSegments.js";
import { useAuthStore } from "../stores/authStore.js";
import { Comments } from "../components/Comments.js";
import { Avatar, Chip, IconBtn, Logo, OverlayLayer, RButton, Tag } from "../components/recio/index.js";
import { Icons, ReticleMark } from "../components/recio/icons.js";

export function SharePage() {
  const { token = "" } = useParams();
  const authed = useAuthStore((s) => s.status === "authed");
  const [view, setView] = useState<PublicShareViewDTO | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "missing" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = () => {
      api
        .resolveShare(token)
        .then((v) => {
          if (cancelled) return;
          setView(v);
          setStatus("ok");
          // Instant-link flow: the upload is still in flight — poll until playable.
          // After 24h we stop: that upload isn't coming (owner can still retry it).
          const stalled = Date.now() - new Date(v.createdAt).getTime() > 24 * 3600 * 1000;
          if (v.processing && !stalled) timer = setTimeout(load, 5000);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.code === "RESOURCE_GONE") setStatus("gone");
          else if (err instanceof ApiError && err.code === "NOT_FOUND") setStatus("missing");
          else setStatus("error");
        });
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  return (
    <div className="r-scroll" style={{ minHeight: "100%", background: "var(--paper)", overflow: "auto" }}>
      <header
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 22px",
          borderBottom: "1px solid var(--line)",
          background: "color-mix(in oklch, var(--surface) 80%, transparent)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        {view?.branding && (view.branding.brandLogoUrl || view.branding.brandName) ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)" }}>
            {view.branding.brandLogoUrl && (
              <img src={view.branding.brandLogoUrl} alt="" style={{ height: 28, maxWidth: 160, objectFit: "contain" }} />
            )}
            {view.branding.brandName && (
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>{view.branding.brandName}</span>
            )}
          </span>
        ) : (
          <Link to="/" style={{ textDecoration: "none" }}>
            <Logo size={22} />
          </Link>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {authed ? (
            <Link to="/dashboard" style={{ textDecoration: "none" }}>
              <RButton variant="ghost" size="sm">Library</RButton>
            </Link>
          ) : view?.branding ? null : (
            <Link to="/register" style={{ textDecoration: "none" }}>
              <RButton variant="ghost" size="sm">Get Vyooom</RButton>
            </Link>
          )}
          {view?.ownerName && <Avatar name={view.ownerName} hue={210} size={30} />}
        </div>
      </header>

      {status === "loading" && <Centered>Loading…</Centered>}
      {/* Remount when processing flips so the video-bound effects (view tracking,
          trim clamp, captions) re-attach to the freshly mounted <video>. */}
      {status === "ok" && view && (
        <ShareViewer key={view.processing ? "processing" : "ready"} view={view} token={token} />
      )}
      {status === "gone" && <Notice title="This link is turned off" body="The owner has made this private." />}
      {status === "missing" && <Notice title="Link not found" body="This share link doesn't exist." />}
      {status === "error" && <Notice title="Something went wrong" body="Please try again later." />}
    </div>
  );
}

function ShareViewer({ view, token }: { view: PublicShareViewDTO; token: string }) {
  const isRecording = view.resourceType === ResourceType.RECORDING;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const [gotIt, setGotIt] = useState(false);
  const [shared, setShared] = useState(false);
  const [vtime, setVtime] = useState(0);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimedReaction[]>([]);
  const [markers, setMarkers] = useState<TimelineComment[]>([]);
  const overlays = view.overlays ?? [];
  useViewTracker(view.resourceType, view.resourceId, videoRef, !view.processing);
  useTrimClamp(videoRef, view.trimStartSec, view.trimEndSec);
  useSkipSegments(videoRef, view.cuts);

  // Captions from the recording's transcript (word timestamps → WebVTT track).
  useEffect(() => {
    if (!isRecording || view.processing) return;
    let url: string | null = null;
    let cancelled = false;
    api
      .shareTranscript(token)
      .then(({ words }) => {
        if (cancelled || !words?.length) return;
        url = vttUrl(words);
        setCaptionsUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [isRecording, view.processing, token]);

  // Timeline data for the player: emoji bursts + comment markers.
  useEffect(() => {
    if (!isRecording || view.processing) return;
    let cancelled = false;
    api
      .getReactions(view.resourceId)
      .then((d) => !cancelled && setTimeline(d.timeline))
      .catch(() => {});
    api
      .getComments(view.resourceId)
      .then((d) => {
        if (cancelled) return;
        setMarkers(
          d.comments
            .filter((c) => c.timestampSec != null)
            .map((c) => ({
              timestampSec: c.timestampSec as number,
              author: c.authorName,
              preview: c.body.slice(0, 80),
            })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isRecording, view.processing, view.resourceId]);

  function reactAt(emoji: string, atSec: number) {
    setTimeline((t) => [...t, { emoji, timestampSec: atSec }]); // optimistic burst
    api
      .react({ resourceType: view.resourceType, resourceId: view.resourceId, emoji: emoji as never, timestampSec: Math.round(atSec * 10) / 10 })
      .then((d) => setTimeline(d.timeline))
      .catch(() => {});
  }

  const created = new Date(view.createdAt);
  const canonicalUrl = view.shareUrl || window.location.href;

  function shareWithTeam() {
    void navigator.clipboard.writeText(canonicalUrl);
    setShared(true);
    setTimeout(() => setShared(false), 1600);
  }

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "28px 24px 60px",
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: 26,
        alignItems: "start",
      }}
    >
      <div>
        {/* player */}
        <div
          style={{
            position: "relative",
            aspectRatio: isRecording ? "16 / 10" : undefined,
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            background: "var(--hud)",
            boxShadow: "var(--e3)",
            border: "1px solid var(--line)",
          }}
        >
          {view.processing ? (
            Date.now() - new Date(view.createdAt).getTime() > 24 * 3600 * 1000 ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,.85)" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>This upload didn't finish</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.6)", maxWidth: 340, textAlign: "center", lineHeight: 1.5 }}>
                  The recording never finished uploading
                  {view.ownerName ? ` from ${view.ownerName.split(" ")[0]}'s device` : ""}. Ask the owner to
                  retry it from their Vyooom popup — the recording is still saved on their device.
                </p>
              </div>
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,.85)" }}>
                <span
                  style={{ display: "inline-block", width: 26, height: 26, borderRadius: "50%", border: "3px solid rgba(255,255,255,.25)", borderTopColor: "var(--accent)", animation: "r-spin 0.8s linear infinite" }}
                />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Still uploading…</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.6)", maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
                  The recording is on its way to {view.ownerName ? `${view.ownerName.split(" ")[0]}'s` : "the owner's"} cloud.
                  This page refreshes itself the moment it's ready.
                </p>
              </div>
            )
          ) : isRecording ? (
            <VideoPlayer
              ref={videoRef}
              src={view.playbackUrl}
              autoPlay
              captionsUrl={captionsUrl}
              durationHint={view.duration ?? undefined}
              comments={markers}
              reactions={timeline}
              reactionEmojis={REACTION_EMOJIS}
              onReact={reactAt}
              onTimeUpdate={setVtime}
              style={{ position: "absolute", inset: 0 }}
            />
          ) : (
            <img src={view.playbackUrl} alt={view.title} style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", display: "block" }} />
          )}
          {!view.processing && overlays.length > 0 && <OverlayLayer overlays={overlays} time={vtime} />}
        </div>

        {view.branding?.ctaLabel && view.branding.ctaUrl && (
          <a href={view.branding.ctaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", marginTop: 12 }}>
            <RButton variant="primary" size="lg" full iconRight={Icons.ArrowR}>
              {view.branding.ctaLabel}
            </RButton>
          </a>
        )}

        {/* title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 18 }}>
          <Avatar name={view.ownerName ?? "Vyooom"} hue={210} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>{view.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)", flexWrap: "wrap" }}>
              {view.ownerName && <b style={{ color: "var(--ink-2)", fontWeight: 600 }}>{view.ownerName}</b>}
              {view.ownerName && <span>·</span>}
              <span>{created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span>·</span>
              <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icons.Eye size={13} /> {view.viewCount}
              </span>
              {isRecording && view.duration ? (
                <>
                  <span>·</span>
                  <span className="mono">{formatDuration(view.duration)}</span>
                </>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <IconBtn icon={Icons.Download} size={36} title="Download" />
            <IconBtn icon={Icons.More} size={36} title="More" />
          </div>
        </div>

        {/* reactions + playback speed */}
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Chip active={gotIt} icon={Icons.Check} onClick={() => setGotIt((v) => !v)}>
            Got it
          </Chip>
          <Chip icon={Icons.Comment} onClick={() => commentsRef.current?.scrollIntoView({ behavior: "smooth" })}>
            Comments
          </Chip>
          <Chip icon={Icons.Users} onClick={shareWithTeam}>
            {shared ? "Link copied" : "Share with team"}
          </Chip>
        </div>

        {/* comments */}
        <div ref={commentsRef} style={{ marginTop: 24 }}>
          <Comments
            resourceType={view.resourceType}
            resourceId={view.resourceId}
            currentTime={isRecording ? () => videoRef.current?.currentTime ?? 0 : undefined}
            onSeek={
              isRecording
                ? (s) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = s;
                      void videoRef.current.play();
                    }
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* right rail */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ShareCard permission={view.permission} url={canonicalUrl} />
        <CloudCard ownerName={view.ownerName} title={view.title} />
      </aside>
    </div>
  );
}

function ShareCard({ permission, url }: { permission: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  function copy() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const ACCESS: [string, typeof Icons.Globe, string, string][] = [
    ["link", Icons.Globe, "Anyone with the link", "Can view & comment"],
    ["team", Icons.Users, "Your team", "Members only"],
    ["private", Icons.Shield, "Only people invited", "Most private"],
  ];
  const active = permission === "PUBLIC" ? "link" : permission === "TEAM" ? "team" : "link";

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, boxShadow: "var(--e1)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Share</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            flex: 1,
            height: 38,
            borderRadius: "var(--r)",
            border: "1px solid var(--line-2)",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 8,
            minWidth: 0,
          }}
        >
          <Icons.Link size={15} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {display}
          </span>
        </div>
        <RButton variant={copied ? "primary" : "dark"} size="md" icon={copied ? Icons.Check : Icons.Copy} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </RButton>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ACCESS.map(([id, Ico, label, sub]) => {
          const on = active === id;
          return (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 10px",
                borderRadius: "var(--r)",
                border: "1px solid",
                borderColor: on ? "var(--accent)" : "transparent",
                background: on ? "var(--accent-soft)" : "transparent",
                textAlign: "left",
              }}
            >
              <Ico size={17} style={{ color: on ? "var(--accent-ink)" : "var(--ink-2)" }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-4)" }}>{sub}</span>
              </span>
              {on && <Icons.Check size={16} style={{ color: "var(--accent-ink)" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CloudCard({ ownerName, title }: { ownerName: string | null; title: string }) {
  const file = `/Vyooom/${new Date().getFullYear()}/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}.mp4`;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, boxShadow: "var(--e1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icons.Cloud size={17} style={{ color: "var(--ink-2)" }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Stored in {ownerName ? `${ownerName.split(" ")[0]}'s` : "your"} cloud</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "10px 12px",
          borderRadius: "var(--r)",
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "oklch(0.62 0.11 145)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          <Icons.Cloud size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Google Drive</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file}
          </div>
        </div>
        <Tag tone="accent">
          <Icons.Check size={11} /> Synced
        </Tag>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--ink-3)" }}>
        Recordings live in <b style={{ color: "var(--ink-2)" }}>their own</b> storage — not ours.
      </p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: 320, alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
      {children}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ display: "flex", minHeight: 360, alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 360, textAlign: "center" }}>
        <div style={{ color: "var(--ink-4)", display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <ReticleMark size={40} sw={1.6} dot={false} />
        </div>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-3)" }}>{body}</p>
        <Link to="/" style={{ display: "inline-block", marginTop: 18, fontSize: 13, color: "var(--accent-ink)", textDecoration: "none" }}>
          Go to Vyooom →
        </Link>
      </div>
    </div>
  );
}
