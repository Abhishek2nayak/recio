// Background service worker: thin orchestration — shortcuts, screenshots, tab launching.
// Recording and uploading happen in real tab contexts (studio / editor) because
// MV3 service workers cannot use MediaRecorder or draw to a canvas for cropping.

const PENDING_CAPTURE_KEY = "pending_capture";

function studioUrl(mode) {
  return chrome.runtime.getURL(`studio/studio.html?mode=${encodeURIComponent(mode || "screen")}`);
}
function editorUrl() {
  return chrome.runtime.getURL("editor/editor.html");
}

async function openStudio(mode) {
  await chrome.tabs.create({ url: studioUrl(mode) });
}

// ── Full-tab screenshot ───────────────────────────────────────────────
async function captureFullTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
  } catch (err) {
    throw new Error(
      "This page can't be captured. Try an ordinary website tab. (" + err.message + ")"
    );
  }
  await chrome.storage.local.set({
    [PENDING_CAPTURE_KEY]: {
      type: "image",
      mimeType: "image/png",
      dataUrl,
      sourceTitle: tab?.title || "Screenshot",
      sourceUrl: tab?.url || "",
      createdAt: Date.now(),
    },
  });
  await chrome.tabs.create({ url: editorUrl() });
}

// ── Area screenshot: inject the selector into the active tab ──────────
async function triggerAreaCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found.");

  // Restricted pages (chrome://, Web Store, new-tab) can't be scripted.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-scripts/area-selector.js"],
    });
  } catch (err) {
    throw new Error(
      "Can't inject into this page. Navigate to a regular website and try again. (" +
        err.message + ")"
    );
  }
}

// ── Handle the selection rect sent back from the area-selector ────────
async function handleAreaSelected(tab, rect) {
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (err) {
    throw new Error("Screenshot capture failed: " + err.message);
  }
  await chrome.storage.local.set({
    [PENDING_CAPTURE_KEY]: {
      type: "image",
      mimeType: "image/png",
      dataUrl,
      cropRect: rect, // editor will crop to this rect using canvas
      sourceTitle: tab.title || "Screenshot",
      sourceUrl: tab.url || "",
      createdAt: Date.now(),
    },
  });
  await chrome.tabs.create({ url: editorUrl() });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === "start-screen-recording") openStudio("screen");
  if (command === "capture-screenshot") {
    // Keyboard shortcut always does area selection.
    triggerAreaCapture().catch((e) => console.warn("[MyLoom] Shortcut screenshot:", e.message));
  }
});

// ── Message hub (popup + content scripts) ────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "OPEN_STUDIO":
          await openStudio(msg.mode);
          return sendResponse({ ok: true });

        case "CAPTURE_SCREENSHOT":
          if (msg.mode === "area") {
            await triggerAreaCapture();
          } else {
            await captureFullTab();
          }
          return sendResponse({ ok: true });

        // Sent by the injected area-selector content script.
        case "AREA_SELECTED":
          if (!sender?.tab) return sendResponse({ ok: false, error: "No sender tab." });
          await handleAreaSelected(sender.tab, msg.rect);
          return sendResponse({ ok: true });

        case "OPEN_OPTIONS":
          await chrome.runtime.openOptionsPage?.();
          return sendResponse({ ok: true });

        default:
          return sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep channel open for the async response
});

// ── First install → open settings/welcome ────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html?welcome=1") });
  }
});
