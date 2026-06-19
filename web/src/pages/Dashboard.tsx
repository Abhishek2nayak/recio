/** Library (home) — the Vyooom dashboard: sticky header (search · filter chips ·
 *  grid/stream toggle), a "recently captured" resume row, and the capture grid. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResourceType, formatDuration, type MediaDTO } from "@flowcap/shared";
import { useMediaLibrary, type Filter } from "../hooks/useMediaLibrary.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { GridCard, StreamRow } from "../components/recio/MediaCardRecio.js";
import { IconBtn, Kbd, RButton } from "../components/recio/index.js";
import { Icons, ReticleMark } from "../components/recio/icons.js";

/** Loom-style library tabs (+ a provider lens for Drive-stored items). */
const TABS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "RECORDINGS", label: "Videos" },
  { key: "SCREENSHOTS", label: "Screenshots" },
  { key: "DRIVE", label: "In your Drive" },
];

export function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [view, setView] = useState<"grid" | "stream">("grid");
  const { items, loading, error, hasMore, loadMore, remove } = useMediaLibrary(filter, "NEWEST", debouncedSearch);

  async function deleteMedia(m: MediaDTO) {
    const ok = window.confirm(
      `Delete "${m.title}"?\n\nThis removes it from your library and (best-effort) from the underlying storage.`,
    );
    if (!ok) return;
    try {
      if (m.resourceType === ResourceType.RECORDING) await api.deleteRecording(m.id);
      else await api.deleteScreenshot(m.id);
      remove(m.id);
    } catch {
      window.alert("Couldn't delete that — try again.");
    }
  }

  const actionsFor = (m: MediaDTO) => ({
    shareUrl: `${config.apiBaseUrl}/s/${m.shareToken}`,
    downloadUrl: m.previewUrl ?? null,
    onDelete: () => void deleteMedia(m),
  });
  const searchRef = useRef<HTMLInputElement | null>(null);

  // `/` focuses search (unless already typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const recent = items.slice(0, 3);

  return (
    <div style={{ minHeight: "100%", background: "var(--paper)" }}>
      {/* sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 28px",
          background: "color-mix(in oklch, var(--paper) 82%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Library</h1>
        <div
          style={{
            flex: 1,
            maxWidth: 320,
            marginLeft: 8,
            height: 38,
            borderRadius: "var(--r)",
            border: "1px solid var(--line-2)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 12px",
          }}
        >
          <Icons.Search size={16} style={{ color: "var(--ink-4)" }} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search captures, titles, people…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--sans)",
              fontSize: 13.5,
              color: "var(--ink)",
            }}
          />
          <Kbd>/</Kbd>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <nav style={{ display: "flex", gap: 2 }}>
            {TABS.map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: "9px 11px 7px",
                    fontFamily: "var(--sans)",
                    fontSize: 13.5,
                    fontWeight: on ? 700 : 500,
                    color: on ? "var(--ink)" : "var(--ink-3)",
                    borderBottom: "2px solid",
                    borderBottomColor: on ? "var(--accent)" : "transparent",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </nav>
          <span style={{ width: 1, height: 24, background: "var(--line-2)" }} />
          <div
            style={{
              display: "flex",
              padding: 3,
              borderRadius: "var(--r)",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              gap: 2,
            }}
          >
            <IconBtn icon={Icons.Grid} size={30} active={view === "grid"} onClick={() => setView("grid")} />
            <IconBtn icon={Icons.Stream} size={30} active={view === "stream"} onClick={() => setView("stream")} />
          </div>
        </div>
      </header>

      <div style={{ padding: "24px 28px 60px" }}>
        {/* recently captured */}
        {!loading && !error && recent.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--ink-2)",
                marginBottom: 13,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icons.Clock size={15} /> Pick up where you left off
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {recent.map((m) => (
                <ResumeCard key={`${m.resourceType}-${m.id}`} media={m} onOpen={() => navigate(hrefFor(m))} />
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 16 }}>
          All captures{" "}
          <span className="mono" style={{ color: "var(--ink-4)", fontWeight: 600 }}>
            {items.length}
          </span>
        </div>

        {error ? (
          <EmptyState
            title="Couldn't load your library"
            description={error}
          />
        ) : loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))", gap: "26px 22px" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <div className="skeleton" style={{ aspectRatio: "16 / 10", borderRadius: "var(--r)" }} />
                <div className="skeleton" style={{ height: 13, width: "75%", borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 11, width: "45%", borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Record your screen or grab a screenshot — your captures show up here, stored in your own cloud."
            action={
              <RButton variant="primary" icon={Icons.Reticle} onClick={() => navigate("/record")}>
                New capture
              </RButton>
            }
          />
        ) : view === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))", gap: "26px 22px" }}>
            {items.map((m, i) => (
              <GridCard key={`${m.resourceType}-${m.id}`} media={m} i={i} actions={actionsFor(m)} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((m, i) => (
              <StreamRow key={`${m.resourceType}-${m.id}`} media={m} i={i} />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
            <RButton variant="outline" onClick={loadMore}>
              Load more
            </RButton>
          </div>
        )}
      </div>
    </div>
  );
}

function hrefFor(m: MediaDTO): string {
  return m.resourceType === ResourceType.RECORDING ? `/recordings/${m.id}` : `/screenshots/${m.id}`;
}

function ResumeCard({ media, onOpen }: { media: MediaDTO; onOpen: () => void }) {
  const isRec = media.resourceType === ResourceType.RECORDING;
  const preview = media.previewUrl ?? media.thumbnailUrl ?? null;
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--e1)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 104,
          flexShrink: 0,
          aspectRatio: "16 / 11",
          borderRadius: "var(--r)",
          overflow: "hidden",
          background: "var(--hud)",
          position: "relative",
        }}
      >
        {preview ? (
          <img src={preview} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: "26%", color: "rgba(255,255,255,.5)" }}>
            <ReticleMark size="48%" sw={1.4} dot={false} color="currentColor" />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {media.title}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
            {isRec && media.duration > 0 ? `${formatDuration(media.duration)} · ` : ""}
            {media.viewCount} views
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-lg)",
        border: "1.5px dashed var(--line-2)",
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ color: "var(--ink-4)", marginBottom: 14 }}>
        <ReticleMark size={36} sw={1.6} dot={false} />
      </div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
      {description && (
        <p style={{ margin: "6px 0 0", maxWidth: 360, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
