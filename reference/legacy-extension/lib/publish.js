// Shared "save to the user's cloud" pipeline used by both the studio (video) and
// the editor (screenshots). Keeps the provider details and recents bookkeeping
// in one place so each UI page only worries about producing a blob.

import { getProvider } from "../providers/provider.js";
import { getSettings, addRecent, newId } from "./store.js";

// Side-effect imports: registering the available providers.
import "../providers/google-drive.js";
import "../providers/dropbox.js";

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(ms) {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function isCloudConnected() {
  const { provider } = await getSettings();
  return getProvider(provider).isConnected();
}

export async function connectCloud() {
  const { provider } = await getSettings();
  return getProvider(provider).connect();
}

// blob, title, type ('video'|'image'), durationMs?, thumbnail?, onProgress?(0..1)
// Returns the saved recent item (incl. viewUrl).
export async function publish({ blob, title, type, durationMs, thumbnail, onProgress }) {
  const settings = await getSettings();
  const provider = getProvider(settings.provider);

  if (!(await provider.isConnected())) {
    await provider.connect();
  }

  const ext = type === "image" ? "png" : extensionForMime(blob.type);
  const safeTitle = (title || defaultTitle(type)).replace(/[\\/:*?"<>|]+/g, " ").trim();
  const name = `${safeTitle}.${ext}`;

  const folderId =
    settings.driveFolderId || (await provider.ensureFolder().catch(() => null)) || undefined;

  let { fileId, viewUrl } = await provider.uploadFile({
    blob,
    name,
    mimeType: blob.type || (type === "image" ? "image/png" : "video/webm"),
    folderId,
    onProgress,
  });

  // Apply the user's sharing preference. "restricted" leaves the file private
  // (only the owner can open it); "anyone" makes the link viewable by anyone.
  if (settings.defaultLinkAccess === "anyone") {
    const shared = await provider.setSharing(fileId, "anyone").catch(() => null);
    if (shared && shared.viewUrl) viewUrl = shared.viewUrl;
  }

  const item = {
    id: newId(),
    title: safeTitle,
    type,
    createdAt: Date.now(),
    durationMs: durationMs || 0,
    sizeBytes: blob.size,
    provider: provider.id,
    fileId,
    viewUrl,
    thumbnail: thumbnail || null,
  };
  await addRecent(item);
  return item;
}

function extensionForMime(mime = "") {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "webm";
}

function defaultTitle(type) {
  const stamp = new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${type === "image" ? "Screenshot" : "Recording"} — ${stamp}`;
}
