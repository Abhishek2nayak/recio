/**
 * Loom-style floating control bar shown while recording: live timer, pause/resume,
 * restart, stop, and cancel. Vertical pill, dark, draggable-feeling. Used in the
 * studio; the on-page content-script bar mirrors this design in vanilla DOM.
 */
import { formatDuration } from "@flowcap/shared";

export function RecordingToolbar({
  state,
  elapsedMs,
  onStop,
  onPause,
  onResume,
  onRestart,
  onCancel,
}: {
  state: "recording" | "paused";
  elapsedMs: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-full border border-border bg-[#0f0f11]/95 p-2 shadow-2xl backdrop-blur">
      {/* Stop */}
      <button
        onClick={onStop}
        title="Stop & save"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
      >
        <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
      </button>

      {/* Timer */}
      <div className="my-1 flex flex-col items-center">
        <span
          className={
            "h-2 w-2 rounded-full " + (state === "recording" ? "animate-pulse bg-danger" : "bg-warning")
          }
        />
        <span className="mt-1 font-mono text-[11px] tabular-nums text-text-primary">
          {formatDuration(elapsedMs / 1000)}
        </span>
      </div>

      {/* Pause / Resume */}
      <Control title={state === "recording" ? "Pause" : "Resume"} onClick={state === "recording" ? onPause : onResume}>
        {state === "recording" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5v14l12-7z" />
          </svg>
        )}
      </Control>

      {onRestart && (
        <Control title="Restart" onClick={onRestart}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </Control>
      )}

      {onCancel && (
        <Control title="Cancel" danger onClick={onCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </Control>
      )}
    </div>
  );
}

function Control({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={
        "flex h-9 w-9 items-center justify-center rounded-full transition-colors " +
        (danger ? "text-muted hover:bg-danger/15 hover:text-danger" : "text-muted hover:bg-card hover:text-text-primary")
      }
    >
      {children}
    </button>
  );
}
