/** A media tile for the dashboard grid: thumbnail, title, meta, storage badge. */
import { Link } from "react-router-dom";
import { ResourceType, formatBytes, formatDuration, type MediaDTO } from "@flowcap/shared";
import { ImageIcon, PlayIcon, VideoIcon } from "./icons.js";
import { StorageBadge } from "./ui.js";

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MediaCard({ media }: { media: MediaDTO }) {
  const isRecording = media.resourceType === ResourceType.RECORDING;
  const href = isRecording ? `/recordings/${media.id}` : `/screenshots/${media.id}`;

  return (
    <Link
      to={href}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-muted"
    >
      <div className="relative aspect-video overflow-hidden bg-bg-secondary">
        {media.thumbnailUrl ? (
          <img src={media.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bg-secondary to-bg-card text-muted">
            {isRecording ? <VideoIcon width={28} height={28} /> : <ImageIcon width={28} height={28} />}
          </div>
        )}
        {isRecording && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
              <PlayIcon width={18} height={18} />
            </span>
          </span>
        )}
        {isRecording && media.duration > 0 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {formatDuration(media.duration)}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{media.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            {formatBytes(media.size)} · {relativeDate(media.createdAt)}
          </p>
        </div>
        <StorageBadge provider={media.storageProvider} />
      </div>
    </Link>
  );
}
