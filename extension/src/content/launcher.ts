/**
 * Host for the recorder launcher. The panel itself is an EXTENSION-ORIGIN iframe
 * (src/launcher) so it has persistent camera/mic permission — this module just injects
 * that iframe into the page (inside the captured shadow-DOM overlay), sizes it from the
 * height it reports, makes it draggable, and relays its intents (arm blur / close).
 */
import { root } from "./overlay.js";
import { toggleBlur } from "./blur.js";

let wrap: HTMLDivElement | null = null;
let iframe: HTMLIFrameElement | null = null;
let dragOverlay: HTMLDivElement | null = null;
let drag: { sx: number; sy: number; left: number; top: number } | null = null;

const EXT_ORIGIN = new URL(chrome.runtime.getURL("")).origin;

export function isLauncherOpen(): boolean {
  return wrap != null;
}

/** Temporarily hide the panel WITHOUT tearing it down (keeps the camera/mic preview
 *  warm) — used while an on-page tool like blur takes over the screen. */
export function collapseLauncher(): void {
  if (wrap) wrap.style.display = "none";
}

/** Bring a collapsed panel back exactly where it was. */
export function restoreLauncher(): void {
  if (wrap) wrap.style.display = "";
}

export function showLauncher(): void {
  // Already mounted (possibly collapsed by a tool) — just make sure it's visible.
  if (wrap) {
    wrap.style.display = "";
    return;
  }
  const w = document.createElement("div");
  w.style.cssText =
    "position:fixed;top:22px;right:22px;width:300px;height:440px;border-radius:22px;overflow:hidden;" +
    "background:#18181f;border:1px solid #2e2e38;box-shadow:0 24px 64px rgba(0,0,0,.6);pointer-events:auto;" +
    "animation:fc-in .2s ease-out;";
  const fr = document.createElement("iframe");
  fr.src = chrome.runtime.getURL("src/launcher/index.html");
  fr.allow = "camera; microphone";
  fr.style.cssText = "width:100%;height:100%;border:0;background:transparent;display:block;";
  w.appendChild(fr);
  root().appendChild(w);
  wrap = w;
  iframe = fr;
  window.addEventListener("message", onMessage);
}

export function hideLauncher(): void {
  window.removeEventListener("message", onMessage);
  endDrag();
  wrap?.remove();
  wrap = null;
  iframe = null;
}

function onMessage(e: MessageEvent): void {
  const d = e.data as { __vyooom?: boolean; type?: string; height?: number; x?: number; y?: number } | null;
  // Only trust messages from our own extension-origin launcher iframe.
  if (!d || d.__vyooom !== true || e.origin !== EXT_ORIGIN || !wrap) return;
  switch (d.type) {
    case "height":
      if (typeof d.height === "number" && d.height > 0) wrap.style.height = `${d.height}px`;
      break;
    case "close":
      hideLauncher();
      break;
    case "arm-blur":
      // Collapse (don't destroy) the panel so blurring has the full screen, then
      // bring the panel right back when the user clicks Done / hits Esc.
      collapseLauncher();
      toggleBlur(restoreLauncher);
      break;
    case "drag-start":
      beginDrag(d.x ?? 0, d.y ?? 0);
      break;
    case "drag-end":
      endDrag();
      break;
  }
}

// Dragging: the iframe reports the press (in screen coords); we capture pointer moves in
// the page via a transparent overlay (the iframe would otherwise swallow them).
function beginDrag(sx: number, sy: number): void {
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  drag = { sx, sy, left: r.left, top: r.top };
  const o = document.createElement("div");
  o.style.cssText = "position:fixed;inset:0;cursor:grabbing;pointer-events:auto;background:transparent;";
  o.addEventListener("pointermove", (e) => {
    if (!drag || !wrap) return;
    wrap.style.left = `${Math.max(4, drag.left + (e.screenX - drag.sx))}px`;
    wrap.style.top = `${Math.max(4, drag.top + (e.screenY - drag.sy))}px`;
    wrap.style.right = "auto";
  });
  o.addEventListener("pointerup", endDrag);
  root().appendChild(o);
  dragOverlay = o;
}

function endDrag(): void {
  drag = null;
  dragOverlay?.remove();
  dragOverlay = null;
}
