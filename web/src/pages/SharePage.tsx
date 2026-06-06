/** Public share viewer at /s/:token — no auth. Resolves the link and plays the media. */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ResourceType, formatDuration, type PublicShareViewDTO } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { useViewTracker } from "../hooks/useViewTracker.js";
import { useTrimClamp } from "../hooks/useTrimClamp.js";
import { useSkipSegments } from "../hooks/useSkipSegments.js";
import { useAuthStore } from "../stores/authStore.js";
import { Reactions } from "../components/Reactions.js";
import { Comments } from "../components/Comments.js";
import { Logo } from "../components/icons.js";
import { Spinner } from "../components/ui.js";

export function SharePage() {
  const { token = "" } = useParams();
  const authed = useAuthStore((s) => s.status === "authed");
  const [view, setView] = useState<PublicShareViewDTO | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "missing" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .resolveShare(token)
      .then((v) => !cancelled && (setView(v), setStatus("ok")))
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "RESOURCE_GONE") setStatus("gone");
        else if (err instanceof ApiError && err.code === "NOT_FOUND") setStatus("missing");
        else setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        {view?.branding && (view.branding.brandLogoUrl || view.branding.brandName) ? (
          <span className="flex items-center gap-2 text-text-primary">
            {view.branding.brandLogoUrl && (
              <img src={view.branding.brandLogoUrl} alt="" className="h-7 max-w-[160px] object-contain" />
            )}
            {view.branding.brandName && (
              <span className="text-sm font-semibold tracking-tight">{view.branding.brandName}</span>
            )}
          </span>
        ) : (
          <Link to="/" className="flex items-center gap-2 text-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-highlight">
              <Logo width={16} height={16} />
            </span>
            <span className="text-sm font-semibold tracking-tight">Recio</span>
          </Link>
        )}
        {authed ? (
          <Link to="/dashboard" className="text-xs text-accent hover:text-accent-hover">
            Open dashboard →
          </Link>
        ) : view?.branding ? null : (
          <Link to="/register" className="text-xs text-accent hover:text-accent-hover">
            Get Recio →
          </Link>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {status === "loading" && <Spinner className="text-muted" />}
        {status === "ok" && view && <ShareViewer view={view} />}
        {status === "gone" && <Notice title="This link is turned off" body="The owner has made this private." />}
        {status === "missing" && <Notice title="Link not found" body="This share link doesn't exist." />}
        {status === "error" && <Notice title="Something went wrong" body="Please try again later." />}
      </main>
    </div>
  );
}

function ShareViewer({ view }: { view: PublicShareViewDTO }) {
  const isRecording = view.resourceType === ResourceType.RECORDING;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useViewTracker(view.resourceType, view.resourceId, videoRef);
  useTrimClamp(videoRef, view.trimStartSec, view.trimEndSec);
  useSkipSegments(videoRef, view.cuts);

  return (
    <div className="w-full max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {isRecording ? (
          <video ref={videoRef} src={view.playbackUrl} controls autoPlay className="aspect-video w-full bg-black" />
        ) : (
          <img src={view.playbackUrl} alt={view.title} className="max-h-[72vh] w-full object-contain" />
        )}
      </div>

      {view.branding?.ctaLabel && view.branding.ctaUrl && (
        <a
          href={view.branding.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-highlight px-4 py-3 text-sm font-semibold text-[#0A0A0A] shadow-sm transition-colors hover:bg-highlight-hover"
        >
          {view.branding.ctaLabel} →
        </a>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {view.ownerName && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-medium text-accent">
              {view.ownerName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="leading-tight">
            <h1 className="text-lg font-semibold">{view.title}</h1>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {view.ownerName ? `${view.ownerName} · ` : ""}
              {view.viewCount} views
              {isRecording && view.duration ? ` · ${formatDuration(view.duration)}` : ""}
            </p>
          </div>
        </div>
        <Reactions resourceType={view.resourceType} resourceId={view.resourceId} />
      </div>

      <div className="mt-6">
        <Comments resourceType={view.resourceType} resourceId={view.resourceId} />
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-sm text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
      <Link to="/" className="mt-5 inline-block text-sm text-accent hover:text-accent-hover">
        Go to Recio →
      </Link>
    </div>
  );
}
