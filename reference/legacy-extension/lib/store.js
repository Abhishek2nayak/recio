// Thin wrapper around chrome.storage for settings + recent-recording metadata.
// Everything here is local to the user's browser; media itself lives in their cloud.

const SETTINGS_KEY = "settings";
const RECENTS_KEY = "recents";
const MAX_RECENTS = 25;

const DEFAULT_SETTINGS = {
  // Recording
  videoQuality: "1080p", // "720p" | "1080p" | "source"
  includeMic: true,
  includeSystemAudio: true,
  webcamMode: "off", // "off" | "pip" | "only"
  countdownSeconds: 3,
  // Cloud
  provider: "google-drive", // active provider id
  driveFolderId: null, // null => save to a "MyLoom" folder we create
  autoCopyLink: true,
  defaultLinkAccess: "anyone", // "anyone" | "restricted"
};

export async function getSettings() {
  const { [SETTINGS_KEY]: stored } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getRecents() {
  const { [RECENTS_KEY]: list } = await chrome.storage.local.get(RECENTS_KEY);
  return Array.isArray(list) ? list : [];
}

// A recent item: { id, title, type:'video'|'image', createdAt, durationMs,
//                  sizeBytes, provider, fileId, viewUrl, thumbnail }
export async function addRecent(item) {
  const list = await getRecents();
  const next = [{ ...item }, ...list.filter((r) => r.id !== item.id)].slice(0, MAX_RECENTS);
  await chrome.storage.local.set({ [RECENTS_KEY]: next });
  return next;
}

export async function updateRecent(id, patch) {
  const list = await getRecents();
  const next = list.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await chrome.storage.local.set({ [RECENTS_KEY]: next });
  return next;
}

export async function removeRecent(id) {
  const list = await getRecents();
  const next = list.filter((r) => r.id !== id);
  await chrome.storage.local.set({ [RECENTS_KEY]: next });
  return next;
}

export function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
