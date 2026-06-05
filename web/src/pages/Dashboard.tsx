import { useState } from "react";
import { clsx } from "clsx";
import { Link } from "react-router-dom";
import { ResourceType, formatBytes, formatDuration, type MediaDTO } from "@flowcap/shared";
import { useMediaLibrary, type Filter, type Sort } from "../hooks/useMediaLibrary.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { MediaCard } from "../components/MediaCard.js";
import { Button, EmptyState, Skeleton, StorageBadge } from "../components/ui.js";
import { ImageIcon, LibraryIcon, ListIcon, LibraryIcon as GridIcon, SearchIcon, VideoIcon } from "../components/icons.js";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "RECORDINGS", label: "Recordings" },
  { key: "SCREENSHOTS", label: "Screenshots" },
  { key: "DRIVE", label: "Drive" },
  { key: "FLOWCAP", label: "Recio" },
];

export function Dashboard() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("NEWEST");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300); // avoid a request per keystroke
  const [view, setView] = useState<"grid" | "list">("grid");
  const { items, loading, error, hasMore, loadMore } = useMediaLibrary(filter, sort, debouncedSearch);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Library</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Your videos & screenshots</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={16} height={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title…"
              className="w-56 rounded-lg border border-border bg-bg-secondary py-2 pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-highlight px-3.5 py-2 text-sm font-semibold text-[#0A0A0A] shadow-sm transition-colors hover:bg-highlight-hover"
          >
            <VideoIcon width={15} height={15} /> New recording
          </a>
        </div>
      </div>

      {/* Tabs + controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap items-center gap-5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                "relative -mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
                filter === f.key
                  ? "border-accent text-text-primary"
                  : "border-transparent text-muted hover:text-text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pb-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-xs text-text-primary shadow-sm outline-none focus:border-accent"
          >
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
            <option value="NAME">Name</option>
            <option value="SIZE">Size</option>
          </select>
          <div className="flex overflow-hidden rounded-lg border border-border shadow-sm">
            <ViewToggle active={view === "grid"} onClick={() => setView("grid")}>
              <GridIcon width={15} height={15} />
            </ViewToggle>
            <ViewToggle active={view === "list"} onClick={() => setView("list")}>
              <ListIcon width={15} height={15} />
            </ViewToggle>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {error ? (
          <EmptyState
            icon={<LibraryIcon width={28} height={28} />}
            title="Couldn't load your library"
            description={error}
          />
        ) : loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<VideoIcon width={28} height={28} />}
            title="Nothing here yet"
            description="Record your screen or grab a screenshot with the Recio extension — it'll show up here."
            action={
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent hover:text-accent-hover"
              >
                Get the extension →
              </a>
            }
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((m) => (
              <MediaCard key={`${m.resourceType}-${m.id}`} media={m} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {items.map((m) => (
              <ListRow key={`${m.resourceType}-${m.id}`} media={m} />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1.5 transition-colors",
        active ? "bg-bg-primary text-text-primary" : "bg-card text-muted hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ListRow({ media }: { media: MediaDTO }) {
  const isRecording = media.resourceType === ResourceType.RECORDING;
  const href = isRecording ? `/recordings/${media.id}` : `/screenshots/${media.id}`;
  return (
    <Link
      to={href}
      className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-0 hover:bg-bg-secondary"
    >
      <span className="text-muted">{isRecording ? <VideoIcon width={16} height={16} /> : <ImageIcon width={16} height={16} />}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{media.title}</span>
      <span className="hidden font-mono text-[11px] text-muted sm:block">
        {isRecording && media.duration > 0 ? `${formatDuration(media.duration)} · ` : ""}
        {formatBytes(media.size)}
      </span>
      <StorageBadge provider={media.storageProvider} />
    </Link>
  );
}
