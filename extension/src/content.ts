/**
 * On-page content script (injected on all pages). Dependency-free UI surfaces, isolated
 * in a Shadow DOM (see ./content/overlay) so host-page CSS can't touch them and so the
 * screen capture bakes them in:
 *
 *  1. Recording dock — Loom-style vertical control rail mirrored from the studio recorder
 *     (./content/dock); drives stop/pause/restart/discard + the blur, draw & camera tools.
 *  2. Live blur (./content/blur) and draw/annotate (./content/draw) — set on the page
 *     during recording and captured live.
 *  3. Region screenshot selector — drag a rectangle (or pick full page); the SW
 *     captures + crops + uploads.
 *  4. Toast — shows the resulting share link with a copy button.
 *  5. Pre-roll 3-2-1 countdown.
 *
 * Kept vanilla (no React, no @flowcap/shared runtime import) so the bundle injected
 * into every page stays tiny.
 */
import { sendMessage, type Message, type Rect } from "./lib/messages.js";
import { CAMERA_SIZE_PX, getSettings, setSettings } from "./lib/storage.js";
import { root, makeDraggable, ICONS } from "./content/overlay.js";
import { initDock, setDockState } from "./content/dock.js";
import { clearBlur } from "./content/blur.js";
import { teardownDraw } from "./content/draw.js";
import { showLauncher, hideLauncher } from "./content/launcher.js";

let recordingActive = false;
let cameraOn = false;

// ── 1. Recording dock + live tool teardown ────────────────────────────────────
initDock({
  isCameraOn: () => cameraOn,
  toggleCamera: async () => {
    const next = !cameraOn;
    cameraOn = next;
    await setSettings({ camera: next });
    await syncCamera();
    return next;
  },
});

function setRecordingState(s: { active: boolean; state: "recording" | "paused"; elapsedMs: number }): void {
  const wasActive = recordingActive;
  recordingActive = s.active;
  setDockState(s);
  if (s.active) hideLauncher(); // recording started → the panel collapses to the dock
  // Recording ended → wipe live blur/draw so they don't linger on the page.
  if (wasActive && !s.active) {
    clearBlur();
    teardownDraw();
  }
  void syncCamera();
}

// ── 2. On-page camera bubble (Loom-style, follows the visible tab) ─────────────
// The bubble is an extension-origin iframe so the camera permission is granted ONCE
// for Vyooom (not per website). Only the *visible* tab mounts it, so there's one
// camera stream at a time and the screen recording captures it wherever you are.
let cameraEl: HTMLElement | null = null;

async function syncCamera(): Promise<void> {
  let cameraEnabled = false;
  let deviceId = "";
  let size = 160;
  let corner: "bottom-left" | "bottom-right" | "top-left" | "top-right" = "bottom-left";
  if (recordingActive) {
    try {
      const s = await getSettings();
      cameraEnabled = s.camera;
      deviceId = s.cameraDeviceId;
      size = CAMERA_SIZE_PX[s.cameraSize] ?? 160;
      corner = s.cameraCorner;
    } catch {
      cameraEnabled = false;
    }
  }
  cameraOn = cameraEnabled;
  const shouldShow = recordingActive && cameraEnabled && document.visibilityState === "visible";
  if (shouldShow) showCamera(deviceId, size, corner);
  else hideCamera();
}

function showCamera(deviceId: string, size: number, corner: string): void {
  if (cameraEl) return;
  const wrap = document.createElement("div");
  wrap.className = "fc-cam";
  // Apply chosen diameter + corner (overrides the stylesheet defaults).
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.top = corner.startsWith("top") ? "24px" : "";
  wrap.style.bottom = corner.startsWith("top") ? "" : "24px";
  wrap.style.left = corner.endsWith("left") ? "24px" : "";
  wrap.style.right = corner.endsWith("left") ? "" : "24px";
  const iframe = document.createElement("iframe");
  const base = chrome.runtime.getURL("src/camera/index.html");
  iframe.src = deviceId ? `${base}?device=${encodeURIComponent(deviceId)}` : base;
  iframe.allow = "camera";
  wrap.appendChild(iframe);
  root().appendChild(wrap);
  cameraEl = wrap;
  makeDraggable(wrap, wrap);
}

function hideCamera(): void {
  cameraEl?.remove();
  cameraEl = null;
}

document.addEventListener("visibilitychange", () => void syncCamera());

// ── 3. Region screenshot selector ─────────────────────────────────────────────
let selectorEl: HTMLElement | null = null;

function startRegionSelection(): void {
  if (selectorEl) return;
  const overlay = document.createElement("div");
  overlay.className = "fc-select";
  overlay.innerHTML = `
    <div class="fc-sel-rect" style="display:none"></div>
    <div class="fc-sel-hint">Drag to capture an area · <button class="fc-sel-full">Full page</button> · <span class="fc-kbd">Esc</span> to cancel</div>`;
  root().appendChild(overlay);
  selectorEl = overlay;

  const rectEl = overlay.querySelector<HTMLElement>(".fc-sel-rect")!;
  let start: { x: number; y: number } | null = null;
  let current: Rect | null = null;

  const teardown = () => {
    overlay.remove();
    selectorEl = null;
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      teardown();
    }
  };
  document.addEventListener("keydown", onKey, true);

  overlay.querySelector<HTMLButtonElement>(".fc-sel-full")!.onclick = (e) => {
    e.stopPropagation();
    teardown();
    void sendMessage({ type: "CAPTURE_REGION", rect: null, dpr: window.devicePixelRatio || 1 });
  };

  overlay.onmousedown = (e) => {
    start = { x: e.clientX, y: e.clientY };
    current = null;
    rectEl.style.display = "block";
  };
  overlay.onmousemove = (e) => {
    if (!start) return;
    current = {
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      width: Math.abs(e.clientX - start.x),
      height: Math.abs(e.clientY - start.y),
    };
    rectEl.style.left = `${current.x}px`;
    rectEl.style.top = `${current.y}px`;
    rectEl.style.width = `${current.width}px`;
    rectEl.style.height = `${current.height}px`;
  };
  overlay.onmouseup = () => {
    const rect = current;
    teardown();
    if (rect && rect.width > 4 && rect.height > 4) {
      // Wait for two frames so the (now-removed) overlay is fully repainted out
      // before the service worker captures the visible tab.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          void sendMessage({ type: "CAPTURE_REGION", rect, dpr: window.devicePixelRatio || 1 }),
        ),
      );
    }
  };
}

// ── 4. Toast ──────────────────────────────────────────────────────────────────
function showToast(title: string, shareUrl?: string | null, error?: string): void {
  const toast = document.createElement("div");
  toast.className = "fc-toast";
  const safeUrl = shareUrl ? shareUrl.replace(/"/g, "") : "";
  toast.innerHTML = `
    <div class="fc-toast-row">
      <span class="fc-toast-icon ${error ? "err" : "ok"}">${error ? ICONS.x : ICONS.check}</span>
      <span class="fc-toast-title">${error ? error : title}</span>
      <button class="fc-toast-close">${ICONS.x}</button>
    </div>
    ${shareUrl ? `<div class="fc-toast-link"><input readonly value="${safeUrl}" /><button class="fc-toast-copy">Copy</button></div>` : ""}`;
  root().appendChild(toast);

  toast.querySelector<HTMLButtonElement>(".fc-toast-close")!.onclick = () => toast.remove();
  const copyBtn = toast.querySelector<HTMLButtonElement>(".fc-toast-copy");
  if (copyBtn && shareUrl) {
    copyBtn.onclick = () => {
      void navigator.clipboard.writeText(shareUrl);
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
    };
  }
  setTimeout(() => toast.remove(), error ? 7000 : 12000);
}

// ── 5. Pre-roll countdown (shown on the active tab before recording begins) ────
let countdownEl: HTMLElement | null = null;

function showCountdown(seconds: number): void {
  countdownEl?.remove();
  const el = document.createElement("div");
  el.className = "fc-count";
  root().appendChild(el);
  countdownEl = el;

  let n = seconds;
  const render = () => {
    el.textContent = String(n);
    el.style.animation = "none";
    // restart the pop animation each tick
    void el.offsetWidth;
    el.style.animation = "fc-count-pop .8s ease-out";
  };
  render();
  const iv = window.setInterval(() => {
    n -= 1;
    if (n <= 0) {
      clearInterval(iv);
      el.remove();
      if (countdownEl === el) countdownEl = null;
    } else {
      render();
    }
  }, 800);
}

// ── message wiring ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: Message) => {
  switch (message.type) {
    case "RECORDING_STATE_PUSH":
      setRecordingState(message.recording);
      break;
    case "SHOW_RECORDER_PANEL":
      void showLauncher();
      break;
    case "START_REGION_SCREENSHOT":
      startRegionSelection();
      break;
    case "SHOW_TOAST":
      showToast(message.title, message.shareUrl, message.error);
      break;
    case "SHOW_COUNTDOWN":
      showCountdown(message.seconds);
      break;
  }
});

// Catch up on load in case a recording is already in progress.
void sendMessage({ type: "GET_RECORDING_STATE" }).then((res) => {
  if (res.ok && res.recording) setRecordingState(res.recording);
});
