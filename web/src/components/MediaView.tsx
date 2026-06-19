/**
 * Media View — the read screen for a recording / screenshot: preview on the left,
 * a right rail with Share options, Share with team, Transcribe, then Edit and
 * Download. Editing (trim / noise removal / summary) lives on the separate Edit
 * page (`/recordings/:id/edit`), reached via the Edit button.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  REACTION_EMOJIS,
  ResourceType,
  formatBytes,
  formatDuration,
  type MediaDTO,
  type RecordingDTO,
  type TimedReaction,
} from "@flowcap/shared";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { vttUrl } from "../lib/vtt.js";
import { useAuthStore } from "../stores/authStore.js";
import { SharePanel } from "./SharePanel.js";
import { Comments } from "./Comments.js";
import { VideoPlayer, type TimelineComment } from "./VideoPlayer/VideoPlayer.js";
import { Avatar, OverlayLayer, RButton, Tag } from "./recio/index.js";
import { Icons } from "./recio/icons.js";

export function MediaView({
  media,
  playbackUrl,
  onRename,
}: {
  media: MediaDTO;
  playbackUrl: string;
  onRename: (title: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [vtime, setVtime] = useState(0);
  const isRecording = media.resourceType === ResourceType.RECORDING;
  const overlays = isRecording ? (media as RecordingDTO).overlays ?? [] : [];
  const editHref = `${isRecording ? "/recordings" : "/screenshots"}/${media.id}/edit`;

  const [title, setTitle] = useState(media.title);
  const [isPublic, setIsPublic] = useState(media.isPublic);
  const [teamCopied, setTeamCopied] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [timeline, setTimeline] = useState<TimedReaction[]>([]);
  const [markers, setMarkers] = useState<TimelineComment[]>([]);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);

  // Player timeline data: emoji bursts, comment markers, captions track.
  useEffect(() => {
    if (!isRecording) return;
    let cancelled = false;
    let captions: string | null = null;
    api.getReactions(media.id).then((d) => !cancelled && setTimeline(d.timeline)).catch(() => {});
    api
      .getComments(media.id)
      .then((d) => {
        if (cancelled) return;
        setMarkers(
          d.comments
            .filter((c) => c.timestampSec != null)
            .map((c) => ({ timestampSec: c.timestampSec as number, author: c.authorName, preview: c.body.slice(0, 80) })),
        );
      })
      .catch(() => {});
    api
      .getTranscript(media.id)
      .then((r) => {
        if (cancelled || !r.transcript?.words?.length) return;
        captions = vttUrl(r.transcript.words);
        setCaptionsUrl(captions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (captions) URL.revokeObjectURL(captions);
    };
  }, [media.id, isRecording]);

  function reactAt(emoji: string, atSec: number) {
    setTimeline((t) => [...t, { emoji, timestampSec: atSec }]);
    api
      .react({ resourceType: media.resourceType, resourceId: media.id, emoji: emoji as never, timestampSec: Math.round(atSec * 10) / 10 })
      .then((d) => setTimeline(d.timeline))
      .catch(() => {});
  }

  async function commitTitle() {
    const next = title.trim();
    if (next && next !== media.title) await onRename(next);
    else setTitle(media.title);
  }

  function shareWithTeam() {
    // Canonical link (API origin) — unfurls with title + thumbnail in Slack/Gmail.
    void navigator.clipboard.writeText(`${config.apiBaseUrl}/s/${media.shareToken}`);
    setTeamCopied(true);
    setTimeout(() => setTeamCopied(false), 1600);
  }

  async function transcribe() {
    setTranscribing(true);
    try {
      await api.generateTranscript(media.id);
      navigate(editHref); // results (summary + transcript) live in the editor
    } catch {
      /* upsell modal handles 402 */
    } finally {
      setTranscribing(false);
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = playbackUrl;
    a.download = media.title || "recio-capture";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 28px 60px" }}>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--ink-3)", padding: "0 0 16px" }}
      >
        ← Library
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 26, alignItems: "start" }}>
        {/* preview + title */}
        <div>
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
              marginBottom: 14,
              padding: 0,
            }}
          />

          <div
            style={{
              position: "relative",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              border: "1px solid var(--line)",
              background: "var(--hud)",
              boxShadow: "var(--e3)",
            }}
          >
            {isRecording ? (
              <div style={{ position: "relative", aspectRatio: "16 / 10" }}>
                <VideoPlayer
                  ref={videoRef}
                  src={playbackUrl}
                  captionsUrl={captionsUrl}
                  durationHint={media.duration > 0 ? media.duration : undefined}
                  comments={markers}
                  reactions={timeline}
                  reactionEmojis={REACTION_EMOJIS}
                  onReact={reactAt}
                  onTimeUpdate={setVtime}
                  style={{ position: "absolute", inset: 0 }}
                />
              </div>
            ) : (
              <img src={playbackUrl} alt={title} style={{ display: "block", width: "100%", maxHeight: "72vh", objectFit: "contain" }} />
            )}
            {overlays.length > 0 && <OverlayLayer overlays={overlays} time={vtime} />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
            <Avatar name={user?.name ?? user?.email ?? "You"} hue={210} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{user?.name ?? "You"}</div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
                {media.viewCount} views · {formatBytes(media.size)}
                {isRecording && media.duration > 0 ? ` · ${formatDuration(media.duration)}` : ""} ·{" "}
                {new Date(media.createdAt).toLocaleDateString()}
              </div>
            </div>
            <Tag tone={isPublic ? "accent" : "neutral"}>{isPublic ? "Shared" : "Private"}</Tag>
          </div>

          <div style={{ marginTop: 22 }}>
            <Comments
              resourceType={media.resourceType}
              resourceId={media.id}
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
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SharePanel shareToken={media.shareToken} isPublic={isPublic} provider={media.storageProvider} onChange={setIsPublic} />

          <RButton variant="soft" full icon={Icons.Users} onClick={shareWithTeam}>
            {teamCopied ? "Link copied" : "Share with team"}
          </RButton>

          {isRecording && (
            <RButton variant="soft" full icon={Icons.Comment} onClick={transcribe} disabled={transcribing}>
              {transcribing ? "Transcribing…" : "Transcribe"}
            </RButton>
          )}

          <div style={{ height: 1, background: "var(--line)", margin: "2px 0" }} />

          <RButton variant="primary" full icon={Icons.Trim} onClick={() => navigate(editHref)}>
            Edit
          </RButton>
          <RButton variant="outline" full icon={Icons.Download} onClick={download}>
            Download
          </RButton>
        </aside>
      </div>
    </div>
  );
}
