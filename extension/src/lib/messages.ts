/**
 * Typed message protocol across popup, service worker, studio (recorder), and the
 * on-page content script (floating bar + region selector + toast).
 *
 * Durable upload + recording state live in the service worker so the ephemeral
 * popup and any tab can read them back.
 */
import type { StorageProvider } from "@flowcap/shared";

export interface UploadState {
  id: string;
  title: string;
  type: "recording" | "screenshot";
  provider: StorageProvider;
  progress: number; // 0..1
  status: "uploading" | "done" | "error";
  shareUrl?: string | null;
  error?: string;
}

export interface RecordingStatus {
  active: boolean;
  state: "recording" | "paused";
  elapsedMs: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Message =
  // popup / shortcuts → SW
  | { type: "OPEN_STUDIO"; mode?: "screen" | "whiteboard" }
  | { type: "START_RECORDING" } // (legacy offscreen path; unused — recording runs in the studio page)
  | { type: "CAPTURE_SCREENSHOT" } // kicks off on-page region selection
  | { type: "GET_UPLOADS" }
  // SW → offscreen document (the actual recorder)
  | { type: "OFFSCREEN_START"; streamId: string }
  | { type: "OFFSCREEN_CONTROL"; action: "pause" | "resume" | "stop" }
  // offscreen → SW
  | { type: "REQUEST_COUNTDOWN"; seconds: number } // ask SW to show a countdown on the active tab
  | { type: "RECORDING_PUBLISHED"; shareUrl: string | null; mediaId: string }
  | { type: "RECORDING_FAILED"; error: string }
  // SW → content (active tab): show a 3-2-1 countdown before recording begins
  | { type: "SHOW_COUNTDOWN"; seconds: number }
  // popup → SW: run OAuth in the SW (survives the popup closing during the flow)
  | { type: "SIGN_IN_GOOGLE" }
  | { type: "CONNECT_DRIVE" }
  | { type: "CONNECT_DROPBOX" }
  // capture pages → SW (upload registry)
  | { type: "UPLOAD_STARTED"; upload: UploadState }
  | { type: "UPLOAD_PROGRESS"; id: string; progress: number }
  | { type: "UPLOAD_DONE"; id: string; shareUrl: string | null }
  | { type: "UPLOAD_FAILED"; id: string; error: string }
  // studio (recorder) → SW: live recording state for the on-page bar
  | { type: "RECORDING_TICK"; state: "recording" | "paused"; elapsedMs: number }
  | { type: "RECORDING_ENDED" }
  // studio → SW: a recording finished uploading (broadcast a toast to all tabs)
  | { type: "STUDIO_PUBLISHED"; shareUrl: string }
  // content bar → SW → studio: remote controls
  | { type: "GET_RECORDING_STATE" }
  | { type: "RECORDING_CONTROL"; action: "pause" | "resume" | "stop" }
  // SW → content (active tab): begin region capture
  | { type: "START_REGION_SCREENSHOT" }
  // content → SW: a region (or null = full visible tab) was selected
  | { type: "CAPTURE_REGION"; rect: Rect | null; dpr: number }
  // SW → content: recording state changed (start / pause / resume / end)
  | { type: "RECORDING_STATE_PUSH"; recording: RecordingStatus }
  // SW → content: surface a result/error toast
  | { type: "SHOW_TOAST"; title: string; shareUrl?: string | null; error?: string };

export type MessageResponse =
  | { ok: true; uploads?: UploadState[]; recording?: RecordingStatus }
  | { ok: false; error: string };

/** Promise wrapper around chrome.runtime.sendMessage (to the service worker). */
export function sendMessage(message: Message): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse>;
}
