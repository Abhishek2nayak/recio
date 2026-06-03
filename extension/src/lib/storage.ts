/**
 * Typed wrapper over `chrome.storage.local`. Holds the FlowCap session (access
 * token + user), the chosen upload destination, and a small recents list. The
 * access token lives here (not a cookie) because the extension calls the API
 * cross-origin from a service worker.
 */
import type { StorageProvider, UserDTO } from "@flowcap/shared";

export interface Session {
  accessToken: string;
  user: UserDTO;
}

export interface RecentItem {
  id: string;
  title: string;
  type: "recording" | "screenshot";
  provider: StorageProvider;
  shareUrl: string | null;
  createdAt: number;
}

export type CameraCorner = "bottom-left" | "bottom-right" | "top-left" | "top-right";
export type RecordingQuality = "high" | "standard" | "saver";

/** Maps a quality preset to MediaRecorder bitrate + capture frame rate. */
export const QUALITY_PRESETS: Record<RecordingQuality, { videoBitsPerSecond: number; frameRate: number; label: string }> = {
  high: { videoBitsPerSecond: 8_000_000, frameRate: 30, label: "High · 1080p60-ish, crisp" },
  standard: { videoBitsPerSecond: 4_000_000, frameRate: 30, label: "Standard · balanced" },
  saver: { videoBitsPerSecond: 2_000_000, frameRate: 24, label: "Data saver · smaller files" },
};

export interface Settings {
  /** Preferred upload destination for new captures. */
  destination: StorageProvider;
  /** Record the webcam bubble alongside the screen. */
  camera: boolean;
  /** Mix microphone audio into the recording. */
  microphone: boolean;
  /** Where the webcam bubble sits in the recording. */
  cameraCorner: CameraCorner;
  /** Recording quality preset (bitrate + frame rate). */
  quality: RecordingQuality;
  /** Chosen input devices (empty = system default). */
  micDeviceId: string;
  cameraDeviceId: string;
  /** Show a 3-2-1 countdown before recording starts. */
  countdown: boolean;
}

interface StoreShape {
  session: Session | null;
  settings: Settings;
  recents: RecentItem[];
}

const DEFAULTS: StoreShape = {
  session: null,
  settings: {
    destination: "FLOWCAP",
    camera: false,
    microphone: true,
    cameraCorner: "bottom-left",
    quality: "standard",
    micDeviceId: "",
    cameraDeviceId: "",
    countdown: true,
  },
  recents: [],
};

export async function getSession(): Promise<Session | null> {
  const { session } = await chrome.storage.local.get("session");
  return (session as Session | null) ?? DEFAULTS.session;
}

export async function setSession(session: Session | null): Promise<void> {
  await chrome.storage.local.set({ session });
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS.settings, ...(settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getRecents(): Promise<RecentItem[]> {
  const { recents } = await chrome.storage.local.get("recents");
  return (recents as RecentItem[] | undefined) ?? [];
}

export async function addRecent(item: RecentItem): Promise<void> {
  const recents = [item, ...(await getRecents())].slice(0, 20);
  await chrome.storage.local.set({ recents });
}
