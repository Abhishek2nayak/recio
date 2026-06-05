/**
 * Excalidraw whiteboard page. Mounts the real Excalidraw component (the official
 * `@excalidraw/excalidraw` React package) filling the main area, themed light to match
 * the app. Recording is done with the Recio extension (record this tab) — the banner
 * explains how — so we reuse the existing record → Drive pipeline without rebuilding it
 * in the web app. See docs / chat: "Web page + record via extension".
 */
import { useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { VideoIcon } from "../components/icons.js";

export function Whiteboard() {
  const [showHint, setShowHint] = useState(true);

  // The public `/whiteboard/embed` route (or `?embed=1`) renders a chrome-less,
  // full-bleed canvas — used when the extension studio embeds this page to record.
  const embed =
    window.location.pathname.endsWith("/whiteboard/embed") ||
    new URLSearchParams(window.location.search).has("embed");
  if (embed) {
    return (
      <div className="h-screen w-screen">
        <Excalidraw theme="light" name="Recio whiteboard" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Whiteboard</p>
          <h1 className="text-lg font-semibold tracking-tight">Draw it out</h1>
        </div>
        {showHint && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-highlight text-[#0A0A0A]">
              <VideoIcon width={15} height={15} />
            </span>
            <p className="max-w-xs text-xs text-muted">
              To save this as a video, click the <strong className="text-text-primary">Recio</strong>{" "}
              extension and record <strong className="text-text-primary">this tab</strong>.
            </p>
            <button
              onClick={() => setShowHint(false)}
              className="shrink-0 text-xs text-muted hover:text-text-primary"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Excalidraw theme="light" name="Recio whiteboard" />
      </div>
    </div>
  );
}
