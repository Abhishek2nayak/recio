/**
 * On-page content script (injected on all pages). Three lightweight, dependency-free
 * UI surfaces, isolated in a Shadow DOM so host-page CSS can't touch them:
 *
 *  1. Floating recording bar — mirrors the studio recorder's state (pushed by the SW)
 *     and relays pause/resume/stop back, so you can control a recording from any tab.
 *  2. Region screenshot selector — drag a rectangle (or pick full page); the SW
 *     captures + crops + uploads.
 *  3. Toast — shows the resulting share link with a copy button.
 *
 * Kept vanilla (no React, no @flowcap/shared runtime import) so the bundle injected
 * into every page stays tiny.
 */
import { sendMessage, type Message, type Rect } from "./lib/messages.js";
import { getSettings } from "./lib/storage.js";

const ACCENT = "#3B82F6";
const DANGER = "#EF4444";
const CARD = "#18181B";
const BORDER = "#27272A";
const TEXT = "#FAFAFA";
const MUTED = "#A1A1AA";

let shadow: ShadowRoot | null = null;

function root(): ShadowRoot {
  if (shadow) return shadow;
  const host = document.createElement("div");
  host.id = "flowcap-overlay-root";
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  document.documentElement.appendChild(host);
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  shadow.appendChild(style);
  return shadow;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ── 1. Floating recording bar ─────────────────────────────────────────────────
let barEl: HTMLElement | null = null;
let barState: { active: boolean; state: "recording" | "paused"; elapsedMs: number; since: number } = {
  active: false,
  state: "recording",
  elapsedMs: 0,
  since: performance.now(),
};
let barTimer: number | null = null;

function ensureBar(): HTMLElement {
  if (barEl) return barEl;
  const bar = document.createElement("div");
  bar.className = "fc-bar";
  bar.innerHTML = `
    <button class="fc-stop" title="Stop & save"><span></span></button>
    <div class="fc-dot-wrap"><span class="fc-dot"></span><span class="fc-time">0:00</span></div>
    <button class="fc-ctrl fc-pause" title="Pause">${ICON_PAUSE}</button>
    <button class="fc-ctrl fc-grip" title="Drag">${ICON_GRIP}</button>`;
  root().appendChild(bar);

  bar.querySelector<HTMLButtonElement>(".fc-stop")!.onclick = () =>
    void sendMessage({ type: "RECORDING_CONTROL", action: "stop" });
  bar.querySelector<HTMLButtonElement>(".fc-pause")!.onclick = () =>
    void sendMessage({ type: "RECORDING_CONTROL", action: barState.state === "recording" ? "pause" : "resume" });

  makeDraggable(bar, bar.querySelector<HTMLElement>(".fc-grip")!);
  barEl = bar;
  return bar;
}

function renderBar(): void {
  const bar = ensureBar();
  bar.style.display = barState.active ? "flex" : "none";
  if (!barState.active) return;
  const pauseBtn = bar.querySelector<HTMLButtonElement>(".fc-pause")!;
  const dot = bar.querySelector<HTMLElement>(".fc-dot")!;
  pauseBtn.innerHTML = barState.state === "recording" ? ICON_PAUSE : ICON_PLAY;
  pauseBtn.title = barState.state === "recording" ? "Pause" : "Resume";
  dot.style.background = barState.state === "recording" ? DANGER : "#F59E0B";
  dot.style.animation = barState.state === "recording" ? "fc-pulse 1.2s infinite" : "none";
}

function tickBar(): void {
  if (!barEl || !barState.active) return;
  const extra = barState.state === "recording" ? performance.now() - barState.since : 0;
  barEl.querySelector<HTMLElement>(".fc-time")!.textContent = fmt(barState.elapsedMs + extra);
}

function setRecordingState(s: { active: boolean; state: "recording" | "paused"; elapsedMs: number }): void {
  barState = { ...s, since: performance.now() };
  recordingActive = s.active;
  renderBar();
  if (s.active && barTimer == null) barTimer = window.setInterval(tickBar, 250);
  if (!s.active && barTimer != null) {
    clearInterval(barTimer);
    barTimer = null;
  }
  tickBar();
  void syncCamera();
}

// ── 1b. On-page camera bubble (Loom-style, follows the visible tab) ────────────
// The bubble is an extension-origin iframe so the camera permission is granted ONCE
// for FlowCap (not per website). Only the *visible* tab mounts it, so there's one
// camera stream at a time and the screen recording captures it wherever you are.
let recordingActive = false;
let cameraEl: HTMLElement | null = null;

async function syncCamera(): Promise<void> {
  let cameraEnabled = false;
  let deviceId = "";
  if (recordingActive) {
    try {
      const s = await getSettings();
      cameraEnabled = s.camera;
      deviceId = s.cameraDeviceId;
    } catch {
      cameraEnabled = false;
    }
  }
  const shouldShow = recordingActive && cameraEnabled && document.visibilityState === "visible";
  if (shouldShow) showCamera(deviceId);
  else hideCamera();
}

function showCamera(deviceId: string): void {
  if (cameraEl) return;
  const wrap = document.createElement("div");
  wrap.className = "fc-cam";
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

// ── 2. Region screenshot selector ─────────────────────────────────────────────
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

// ── 3. Toast ──────────────────────────────────────────────────────────────────
function showToast(title: string, shareUrl?: string | null, error?: string): void {
  const toast = document.createElement("div");
  toast.className = "fc-toast";
  const safeUrl = shareUrl ? shareUrl.replace(/"/g, "") : "";
  toast.innerHTML = `
    <div class="fc-toast-row">
      <span class="fc-toast-icon ${error ? "err" : "ok"}">${error ? ICON_X : ICON_CHECK}</span>
      <span class="fc-toast-title">${error ? error : title}</span>
      <button class="fc-toast-close">${ICON_X}</button>
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

// ── helpers ───────────────────────────────────────────────────────────────────
function makeDraggable(el: HTMLElement, handle: HTMLElement): void {
  let ox = 0;
  let oy = 0;
  let dragging = false;
  handle.style.cursor = "grab";
  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    el.style.left = `${Math.max(4, e.clientX - ox)}px`;
    el.style.top = `${Math.max(4, e.clientY - oy)}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  });
  handle.addEventListener("pointerup", () => (dragging = false));
}

// ── message wiring ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: Message) => {
  switch (message.type) {
    case "RECORDING_STATE_PUSH":
      setRecordingState(message.recording);
      break;
    case "START_REGION_SCREENSHOT":
      startRegionSelection();
      break;
    case "SHOW_TOAST":
      showToast(message.title, message.shareUrl, message.error);
      break;
  }
});

// Catch up on load in case a recording is already in progress.
void sendMessage({ type: "GET_RECORDING_STATE" }).then((res) => {
  if (res.ok && res.recording) setRecordingState(res.recording);
});

const ICON_PAUSE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const ICON_PLAY = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>`;
const ICON_GRIP = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>`;
const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON_X = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; }
.fc-bar {
  position: fixed; left: 20px; top: 50%; transform: translateY(-50%);
  display: none; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px; border-radius: 999px; background: ${CARD}f2; border: 1px solid ${BORDER};
  box-shadow: 0 12px 32px rgba(0,0,0,.5); pointer-events: auto; backdrop-filter: blur(8px);
}
.fc-stop { width: 42px; height: 42px; border-radius: 999px; border: none; background: ${DANGER};
  display: flex; align-items: center; justify-content: center; cursor: pointer; }
.fc-stop span { width: 13px; height: 13px; border-radius: 3px; background: #fff; }
.fc-dot-wrap { display: flex; flex-direction: column; align-items: center; margin: 2px 0; }
.fc-dot { width: 8px; height: 8px; border-radius: 999px; background: ${DANGER}; }
.fc-time { font-family: ui-monospace, monospace; font-size: 11px; color: ${TEXT}; margin-top: 3px; }
.fc-ctrl { width: 34px; height: 34px; border-radius: 999px; border: none; background: transparent;
  color: ${MUTED}; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.fc-ctrl:hover { background: #ffffff14; color: ${TEXT}; }
@keyframes fc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

.fc-select { position: fixed; inset: 0; cursor: crosshair; pointer-events: auto;
  background: rgba(10,10,11,.35); }
.fc-sel-rect { position: fixed; border: 2px solid ${ACCENT}; background: ${ACCENT}1a;
  box-shadow: 0 0 0 99999px rgba(10,10,11,.45); }
.fc-sel-hint { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
  background: ${CARD}; border: 1px solid ${BORDER}; color: ${TEXT}; font-size: 13px;
  padding: 8px 14px; border-radius: 999px; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.fc-sel-full { background: ${ACCENT}; color: #fff; border: none; border-radius: 6px;
  padding: 2px 8px; font-size: 12px; cursor: pointer; }
.fc-kbd { font-family: ui-monospace, monospace; background: ${BORDER}; padding: 1px 6px; border-radius: 4px; }

.fc-toast { position: fixed; right: 20px; bottom: 20px; width: 340px; pointer-events: auto;
  background: ${CARD}; border: 1px solid ${BORDER}; border-radius: 12px; padding: 12px 14px;
  box-shadow: 0 16px 40px rgba(0,0,0,.55); color: ${TEXT}; animation: fc-in .24s ease-out; }
@keyframes fc-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fc-toast-row { display: flex; align-items: center; gap: 10px; }
.fc-toast-icon { display: flex; width: 22px; height: 22px; border-radius: 999px; align-items: center; justify-content: center; }
.fc-toast-icon.ok { background: #22C55E26; color: #22C55E; }
.fc-toast-icon.err { background: #EF444426; color: ${DANGER}; }
.fc-toast-title { flex: 1; font-size: 13px; font-weight: 500; }
.fc-toast-close { background: transparent; border: none; color: ${MUTED}; cursor: pointer; padding: 2px; }
.fc-toast-link { display: flex; gap: 8px; margin-top: 10px; }
.fc-toast-link input { flex: 1; background: #111113; border: 1px solid ${BORDER}; border-radius: 6px;
  color: ${TEXT}; font-family: ui-monospace, monospace; font-size: 11px; padding: 6px 8px; outline: none; }
.fc-toast-copy { background: ${ACCENT}; color: #fff; border: none; border-radius: 6px; padding: 0 12px;
  font-size: 12px; font-weight: 500; cursor: pointer; }

.fc-cam { position: fixed; left: 24px; bottom: 24px; width: 160px; height: 160px; border-radius: 999px;
  overflow: hidden; border: 3px solid rgba(255,255,255,.9); box-shadow: 0 12px 32px rgba(0,0,0,.55);
  pointer-events: auto; cursor: grab; background: #000; }
.fc-cam iframe { width: 100%; height: 100%; border: 0; pointer-events: none; }
`;
