/**
 * Shared on-page overlay primitives for the content-script surfaces (recording dock,
 * live blur, draw/annotate, camera bubble, region screenshot, toast, countdown).
 *
 * Everything lives in a single Shadow DOM host pinned at the top z-index so host-page
 * CSS can't touch it. The host is `pointer-events: none`; individual surfaces opt back
 * in with `pointer-events: auto`. Critically, this overlay is part of the page, so
 * `getDisplayMedia` captures it — that's how the camera bubble, blur regions, and pen
 * strokes all bake into the recording.
 *
 * Kept vanilla (no React, no @flowcap/shared runtime import) so the bundle injected
 * into every page stays tiny.
 */

// Vyooom HUD palette (hex approximations of the oklch tokens — this overlay lives in a
// shadow DOM and can't read the page's CSS vars).
export const ACCENT = "#38C6DD"; // Tide cyan — the electric pop; pairs with dark text only
export const ACCENT_INK = "#06303A"; // readable foreground on ACCENT
export const DANGER = "#DC2626";
export const CARD = "#28283A"; // --hud (near-black glass)
export const BORDER = "#52525F"; // --hud-line
export const TEXT = "#F2F2F5"; // --hud-ink
export const MUTED = "#A9A9B6"; // --hud-ink-2

export const HOST_ID = "flowcap-overlay-root";

let shadow: ShadowRoot | null = null;

/** The shared shadow root, created (and styled) on first use. */
export function root(): ShadowRoot {
  if (shadow) return shadow;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  document.documentElement.appendChild(host);
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  shadow.appendChild(style);
  return shadow;
}

/** mm:ss from milliseconds. */
export function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Make `el` draggable by `handle` (pointer-based, switches to top/left anchoring). */
export function makeDraggable(el: HTMLElement, handle: HTMLElement): void {
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

/** Tiny element factory: `el("div", "class", innerHTML)`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

// ── Shared icons (inline SVG strings, since these surfaces are vanilla) ───────────
export const ICONS = {
  stop: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>`,
  pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
  play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>`,
  restart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5h15M9 6.5V5a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5v1.5M6.5 6.5l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/></svg>`,
  blur: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" stroke-dasharray="2.2 3"/><circle cx="12" cy="12" r="3.4"/></svg>`,
  pen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5l4 4M4 20l1.2-4.2L16 5a2 2 0 0 1 3 3L8.2 18.8 4 20Z"/></svg>`,
  cam: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10l5-2.6v9.2l-5-2.6"/></svg>`,
  camOff: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5l18 18M15.5 10l5-2.6v9.2M10.5 6H5a2.5 2.5 0 0 0-2.5 2.5V16A2.5 2.5 0 0 0 5 18.5h8"/></svg>`,
  grip: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L19 5M10 5h9v9"/></svg>`,
  rect: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1.5"/></svg>`,
  highlight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 16l9-9 3 3-9 9H6z"/></svg>`,
  undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>`,
  clear: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  x: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  home: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6.5 8 6.5M6 9.5V19h12V9.5"/></svg>`,
  video: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10l5-2.6v9.2l-5-2.6"/></svg>`,
  shot: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2.5v5M2.5 7.5h5M16.5 21.5v-5M21.5 16.5h-5"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/></svg>`,
  screen: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 20.5h7M12 17.5v3"/></svg>`,
  window: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 8.5h18"/></svg>`,
  tab: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h5l1.5 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`,
  mic: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4M8.5 21.5h7"/></svg>`,
  micOff: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5.2A3 3 0 0 1 15 6v4M15 13.3a3 3 0 0 1-4.4 1.3M5.5 11a6.5 6.5 0 0 0 10 5.4M12 17.5v4M8.5 21.5h7M3.5 3.5l17 17"/></svg>`,
  chevron: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  more: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`,
  clock: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/></svg>`,
  effects: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/></svg>`,
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; }

/* ── On-page launcher panel (modelled on Loom's floating recorder) ── */
.fc-launch { position: fixed; right: 22px; top: 22px; width: 300px; pointer-events: auto;
  background: #18181f; border: 1px solid #2e2e38; border-radius: 22px; color: ${TEXT};
  box-shadow: 0 24px 64px rgba(0,0,0,.6); font-size: 13px; overflow: hidden; animation: fc-in .2s ease-out; }
.fc-launch-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; }
.fc-launch-home { width: 38px; height: 38px; border-radius: 999px; border: none; background: #25252f; color: ${TEXT};
  cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fc-launch-home:hover { background: #303040; }
.fc-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: #25252f; }
.fc-tab { width: 52px; height: 30px; border-radius: 999px; border: none; background: transparent; color: ${MUTED};
  cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fc-tab:hover { color: ${TEXT}; }
.fc-tab.active { background: ${ACCENT}; color: ${ACCENT_INK}; }
.fc-launch-x { margin-left: auto; width: 38px; height: 38px; border-radius: 999px; border: none; background: transparent;
  color: ${MUTED}; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fc-launch-x:hover { background: #25252f; color: ${TEXT}; }
.fc-launch-body { padding: 4px 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.fc-launch-preview { width: 124px; height: 124px; border-radius: 999px; overflow: hidden; align-self: center;
  border: 3px solid #ffffffe6; background: #000; box-shadow: 0 8px 24px rgba(0,0,0,.5); margin: 2px 0 4px; }
.fc-launch-preview iframe { width: 100%; height: 100%; border: 0; }

/* full-width selector / toggle rows */
.fc-srow { display: flex; align-items: center; gap: 13px; padding: 13px 15px; border-radius: 14px;
  border: none; background: #25252f; color: ${TEXT}; cursor: pointer; width: 100%; text-align: left; position: relative; }
.fc-srow:hover { background: #2c2c38; }
.fc-srow-ico { display: flex; color: ${TEXT}; }
.fc-srow-txt { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; }
.fc-pill { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; letter-spacing: .02em; }
.fc-pill.off { background: #3a3a46; color: #b9b9c6; }
.fc-pill.on { background: #16A34A; color: #fff; }
.fc-mic-meter { position: absolute; left: 15px; right: 15px; bottom: 7px; height: 3px; border-radius: 99px; background: #ffffff14; overflow: hidden; }
.fc-mic-meter i { display: block; height: 100%; width: 0%; background: ${ACCENT}; transition: width .08s linear; }
.fc-chev { color: ${MUTED}; display: flex; }

/* surface dropdown */
.fc-surf-menu { display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 14px; background: #20202a; border: 1px solid #2e2e38; }
.fc-surf-opt { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 10px; border: none;
  background: transparent; color: ${TEXT}; cursor: pointer; font-size: 13px; font-weight: 600; text-align: left; width: 100%; }
.fc-surf-opt:hover { background: #2c2c38; }
.fc-surf-opt.active { color: ${ACCENT}; }
.fc-surf-opt svg { color: ${MUTED}; }

/* start + pencil */
.fc-start-row { display: flex; gap: 8px; }
.fc-start { flex: 1; display: flex; align-items: center; justify-content: center; gap: 9px; height: 48px; border: none;
  border-radius: 14px; background: ${ACCENT}; color: ${ACCENT_INK}; font-size: 15px; font-weight: 800; cursor: pointer;
  transition: filter .12s ease; }
.fc-start:hover { filter: brightness(1.06); }
.fc-pencil { width: 48px; height: 48px; border-radius: 14px; border: 1px solid #2e2e38; background: #25252f; color: ${TEXT};
  cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fc-pencil:hover { background: #2c2c38; }

/* footer */
.fc-foot { display: flex; gap: 4px; padding-top: 2px; }
.fc-foot button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 2px;
  border-radius: 12px; border: none; background: transparent; color: ${MUTED}; cursor: pointer; font-size: 11px; font-weight: 600; }
.fc-foot button:hover { background: #25252f; color: ${TEXT}; }
.fc-foot button.active { background: ${ACCENT}1f; color: ${ACCENT}; }

/* effects / more sub-sections */
.fc-fx { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: #20202a; }
.fc-fx-label { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: ${MUTED}; }
.fc-chips { display: grid; gap: 6px; }
.fc-chip { height: 32px; border-radius: 9px; border: 1px solid #2e2e38; background: #25252f; color: ${MUTED};
  cursor: pointer; font-size: 11.5px; font-weight: 600; }
.fc-chip:hover { color: ${TEXT}; }
.fc-chip.active { border-color: ${ACCENT}; background: ${ACCENT}1f; color: ${ACCENT}; }
.fc-launch-note { font-size: 11px; color: ${MUTED}; line-height: 1.5; }
.fc-launch-note b { color: ${TEXT}; }

/* ── Recording dock (Loom-style left-edge vertical) ── */
.fc-dock {
  position: fixed; left: 18px; top: 50%; transform: translateY(-50%);
  display: none; flex-direction: column; align-items: center; gap: 5px;
  padding: 9px 8px; border-radius: 26px; background: ${CARD}f2; border: 1px solid ${BORDER};
  box-shadow: 0 14px 38px rgba(0,0,0,.55); pointer-events: auto; backdrop-filter: blur(10px) saturate(150%);
}
.fc-dock.show { display: flex; }
.fc-dock-stop { width: 44px; height: 44px; border-radius: 999px; border: none; background: ${ACCENT};
  color: ${ACCENT_INK}; display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: transform .12s ease; }
.fc-dock-stop:hover { transform: scale(1.06); }
.fc-dock-time { display: flex; flex-direction: column; align-items: center; gap: 3px; margin: 1px 0; }
.fc-dock-dot { width: 8px; height: 8px; border-radius: 999px; background: ${ACCENT}; box-shadow: 0 0 8px ${ACCENT}; }
.fc-dock-clock { font-family: ui-monospace, monospace; font-size: 11px; color: ${TEXT}; }
.fc-dock-sep { width: 26px; height: 1px; background: ${BORDER}; margin: 2px 0; }
.fc-btn { width: 36px; height: 36px; border-radius: 999px; border: none; background: transparent;
  color: ${MUTED}; display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background .12s ease, color .12s ease; position: relative; }
.fc-btn:hover { background: #ffffff16; color: ${TEXT}; }
.fc-btn.active { background: ${ACCENT}26; color: ${ACCENT}; }
.fc-btn.danger:hover { background: ${DANGER}26; color: #FCA5A5; }
@keyframes fc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

/* ── Live blur regions + arm overlay ── */
.fc-blur-region { position: fixed; pointer-events: none; border-radius: 6px; overflow: hidden;
  backdrop-filter: blur(11px); -webkit-backdrop-filter: blur(11px); background: rgba(120,120,140,.16);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.10); }
.fc-blur-region.editing { pointer-events: auto; box-shadow: inset 0 0 0 1.5px ${ACCENT}; cursor: move; }
.fc-blur-x { position: absolute; top: -9px; right: -9px; width: 20px; height: 20px; border-radius: 999px;
  background: ${DANGER}; color: white; border: 2px solid ${CARD}; display: none; align-items: center;
  justify-content: center; cursor: pointer; padding: 0; }
.fc-blur-region.editing .fc-blur-x { display: flex; }
.fc-arm { position: fixed; inset: 0; cursor: crosshair; pointer-events: auto; background: rgba(10,10,11,.18); }
.fc-arm-snap { position: fixed; pointer-events: none; border: 2px solid ${ACCENT}; border-radius: 6px;
  background: ${ACCENT}1f; display: none; }
.fc-arm-rect { position: fixed; pointer-events: none; border: 2px dashed ${ACCENT}; border-radius: 6px;
  background: ${ACCENT}1a; display: none; }
.fc-arm-hint { position: fixed; left: 50%; top: 22px; transform: translateX(-50%); display: flex;
  align-items: center; gap: 10px; background: ${CARD}; border: 1px solid ${BORDER}; color: ${TEXT};
  font-size: 13px; padding: 8px 12px 8px 14px; border-radius: 999px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
  pointer-events: auto; }
.fc-arm-hint b { color: ${ACCENT}; font-weight: 600; }
.fc-arm-done { background: ${ACCENT}; color: ${ACCENT_INK}; border: none; border-radius: 999px;
  padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }

/* ── Draw / annotate ── */
.fc-draw-canvas { position: fixed; inset: 0; pointer-events: none; }
.fc-draw-canvas.on { pointer-events: auto; cursor: crosshair; }
.fc-draw-bar { position: fixed; left: 74px; top: 50%; transform: translateY(-50%); display: none;
  flex-direction: column; gap: 4px; padding: 8px; border-radius: 18px; background: ${CARD}f2;
  border: 1px solid ${BORDER}; box-shadow: 0 14px 38px rgba(0,0,0,.5); pointer-events: auto;
  backdrop-filter: blur(10px); }
.fc-draw-bar.show { display: flex; }
.fc-draw-swatches { display: flex; flex-wrap: wrap; gap: 5px; width: 78px; padding: 4px 2px; justify-content: center; }
.fc-swatch { width: 18px; height: 18px; border-radius: 999px; border: 2px solid transparent; cursor: pointer; padding: 0; }
.fc-swatch.active { border-color: ${TEXT}; box-shadow: 0 0 0 1px ${CARD}; }

/* ── Region screenshot selector ── */
.fc-select { position: fixed; inset: 0; cursor: crosshair; pointer-events: auto; background: rgba(10,10,11,.35); }
.fc-sel-rect { position: fixed; border: 2px solid ${ACCENT}; background: ${ACCENT}1a;
  box-shadow: 0 0 0 99999px rgba(10,10,11,.45); }
.fc-sel-hint { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
  background: ${CARD}; border: 1px solid ${BORDER}; color: ${TEXT}; font-size: 13px;
  padding: 8px 14px; border-radius: 999px; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.fc-sel-full { background: ${ACCENT}; color: #0A0A0A; border: none; border-radius: 6px;
  padding: 2px 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.fc-kbd { font-family: ui-monospace, monospace; background: ${BORDER}; padding: 1px 6px; border-radius: 4px; }

/* ── Toast ── */
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
.fc-toast-copy { background: ${ACCENT}; color: #0A0A0A; border: none; border-radius: 6px; padding: 0 12px;
  font-size: 12px; font-weight: 600; cursor: pointer; }

/* ── Countdown ── */
.fc-count { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: none; font-family: ui-monospace, monospace; font-weight: 700;
  font-size: 168px; line-height: 1; color: ${ACCENT}; text-shadow: 0 6px 30px rgba(0,0,0,.55); }
@keyframes fc-count-pop { 0% { transform: scale(.55); opacity: 0; } 30% { opacity: 1; } 100% { transform: scale(1.25); opacity: 0; } }

/* ── Camera bubble ── */
.fc-cam { position: fixed; left: 24px; bottom: 24px; width: 160px; height: 160px; border-radius: 999px;
  overflow: hidden; border: 3px solid rgba(255,255,255,.9); box-shadow: 0 12px 32px rgba(0,0,0,.55);
  pointer-events: auto; cursor: grab; background: #000; }
.fc-cam iframe { width: 100%; height: 100%; border: 0; pointer-events: none; }`;
