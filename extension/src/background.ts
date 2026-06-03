/**
 * Service worker. MV3 SWs can't use MediaRecorder, so recording happens in the
 * studio tab; the SW does the light privileged work:
 *   - keyboard shortcuts
 *   - open the studio
 *   - hold durable upload + recording state (so the popup and on-page bar can read it)
 *   - relay remote recording controls from the on-page bar to the studio
 *   - run the screenshot region pipeline: capture visible tab → crop (OffscreenCanvas)
 *     → upload to the default destination → toast the share link back to the page
 */
import {
  type Message,
  type MessageResponse,
  type RecordingStatus,
  type Rect,
  type UploadState,
} from "./lib/messages.js";
import { publishScreenshot } from "./storage/swPublish.js";
import { connectDrive, signInWithGoogle } from "./auth/googleAuth.js";
import { config } from "./config.js";

const uploads = new Map<string, UploadState>();

const recording: RecordingStatus & { studioTabId: number | null } = {
  active: false,
  state: "recording",
  elapsedMs: 0,
  studioTabId: null,
};

function studioUrl(): string {
  return chrome.runtime.getURL("src/studio/index.html");
}

async function openStudio(): Promise<void> {
  await chrome.tabs.create({ url: studioUrl() });
}

/** Push the current recording state to every tab's content script (on transitions). */
async function broadcastRecordingState(): Promise<void> {
  const snapshot: RecordingStatus = {
    active: recording.active,
    state: recording.state,
    elapsedMs: recording.elapsedMs,
  };
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs
        .sendMessage(tab.id, { type: "RECORDING_STATE_PUSH", recording: snapshot } satisfies Message)
        .catch(() => {});
    }
  }
}

/** Pages we can't inject a content script into → fall back to a full capture. */
function isInjectable(url: string | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//.test(url) && !url.startsWith("https://chrome.google.com/webstore");
}

/** Start on-page region selection on the active tab (fallback: full visible capture). */
async function startScreenshot(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (!isInjectable(tab.url)) {
    // chrome://, the web store, PDFs, etc. — no overlay possible, capture full tab.
    await captureAndPublish(tab.id, tab.windowId, null, 1);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SCREENSHOT" } satisfies Message);
  } catch {
    // Content script not loaded on this tab yet (e.g. opened before an extension
    // reload). Inject it on demand, then retry; only full-capture if that fails too.
    try {
      const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
      if (files?.length) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
      await chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SCREENSHOT" } satisfies Message);
    } catch {
      await captureAndPublish(tab.id, tab.windowId, null, 1);
    }
  }
}

/** Capture the visible tab, optionally crop to `rect`, upload, and toast the link. */
async function captureAndPublish(
  tabId: number,
  windowId: number | undefined,
  rect: Rect | null,
  dpr: number,
): Promise<void> {
  const toast = (msg: Message) => chrome.tabs.sendMessage(tabId, msg).catch(() => {});
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, {
      format: "png",
    });
    const blob = await cropDataUrl(dataUrl, rect, dpr);
    const title = `Screenshot — ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    const { mediaId, shareUrl } = await publishScreenshot(blob, title);
    await toast({ type: "SHOW_TOAST", title: "Screenshot saved", shareUrl } satisfies Message);
    // Open the Loom-style detail page (rename / preview / share), like recordings do.
    await chrome.tabs.create({ url: `${config.webBaseUrl}/screenshots/${mediaId}` });
  } catch (err) {
    await toast({
      type: "SHOW_TOAST",
      title: "Screenshot failed",
      error: err instanceof Error ? err.message : "Something went wrong.",
    } satisfies Message);
  }
}

/** Crop a captured PNG dataURL to a CSS-pixel rect (scaled by devicePixelRatio). */
async function cropDataUrl(dataUrl: string, rect: Rect | null, dpr: number): Promise<Blob> {
  const fullBlob = await (await fetch(dataUrl)).blob();
  if (!rect) return fullBlob;

  const bitmap = await createImageBitmap(fullBlob);
  const sx = Math.max(0, Math.round(rect.x * dpr));
  const sy = Math.max(0, Math.round(rect.y * dpr));
  const sw = Math.max(1, Math.round(rect.width * dpr));
  const sh = Math.max(1, Math.round(rect.height * dpr));
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return fullBlob;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/png" });
}

/**
 * Inject the content script into already-open http(s) tabs. Chrome only auto-injects
 * on navigation, so after an extension reload existing tabs would otherwise have no
 * region selector / toast. Runs on install + startup.
 */
async function injectIntoExistingTabs(): Promise<void> {
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length) return;
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(() => void injectIntoExistingTabs());
chrome.runtime.onStartup.addListener(() => void injectIntoExistingTabs());

chrome.commands.onCommand.addListener((command) => {
  if (command === "start-screen-recording") void openStudio();
  if (command === "capture-screenshot") void startScreenshot();
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  void handleMessage(message, sender).then(sendResponse).catch((err: unknown) =>
    sendResponse({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
  );
  return true; // async
});

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  switch (message.type) {
    case "OPEN_STUDIO":
      await openStudio();
      return { ok: true };

    case "CAPTURE_SCREENSHOT":
      await startScreenshot();
      return { ok: true };

    // OAuth flows run here (not the popup) so they survive the popup closing.
    case "SIGN_IN_GOOGLE":
      await signInWithGoogle();
      return { ok: true };
    case "CONNECT_DRIVE":
      await connectDrive();
      return { ok: true };

    case "CAPTURE_REGION":
      if (sender.tab?.id) {
        void captureAndPublish(sender.tab.id, sender.tab.windowId, message.rect, message.dpr);
      }
      return { ok: true };

    case "GET_UPLOADS":
      return { ok: true, uploads: [...uploads.values()] };

    case "UPLOAD_STARTED":
      uploads.set(message.upload.id, message.upload);
      return { ok: true };
    case "UPLOAD_PROGRESS": {
      const u = uploads.get(message.id);
      if (u) u.progress = message.progress;
      return { ok: true };
    }
    case "UPLOAD_DONE": {
      const u = uploads.get(message.id);
      if (u) {
        u.status = "done";
        u.progress = 1;
        u.shareUrl = message.shareUrl;
        setTimeout(() => uploads.delete(message.id), 60_000);
      }
      return { ok: true };
    }
    case "UPLOAD_FAILED": {
      const u = uploads.get(message.id);
      if (u) {
        u.status = "error";
        u.error = message.error;
      }
      return { ok: true };
    }

    // ── Recording state (from the studio) ──
    case "RECORDING_TICK": {
      const transition = !recording.active || recording.state !== message.state;
      recording.active = true;
      recording.state = message.state;
      recording.elapsedMs = message.elapsedMs;
      recording.studioTabId = sender.tab?.id ?? recording.studioTabId;
      if (transition) void broadcastRecordingState(); // start / pause / resume
      return { ok: true };
    }
    case "RECORDING_ENDED":
      recording.active = false;
      recording.elapsedMs = 0;
      recording.studioTabId = null;
      void broadcastRecordingState();
      return { ok: true };

    case "STUDIO_PUBLISHED": {
      // Surface the link on every tab — handy when the user stopped from the on-page bar.
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id != null) {
          chrome.tabs
            .sendMessage(tab.id, {
              type: "SHOW_TOAST",
              title: "Recording saved",
              shareUrl: message.shareUrl,
            } satisfies Message)
            .catch(() => {});
        }
      }
      return { ok: true };
    }
    case "GET_RECORDING_STATE":
      return {
        ok: true,
        recording: { active: recording.active, state: recording.state, elapsedMs: recording.elapsedMs },
      };

    // ── Remote controls (from the on-page bar → studio) ──
    case "RECORDING_CONTROL":
      if (recording.studioTabId != null) {
        chrome.tabs.sendMessage(recording.studioTabId, message).catch(() => {});
      }
      return { ok: true };

    default:
      return { ok: false, error: "Unhandled message" };
  }
}
