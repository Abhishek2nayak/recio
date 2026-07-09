/**
 * Floating recording dock — a Loom-style vertical control rail pinned to the left edge,
 * mirrored to every tab so you can drive a recording from wherever you are. Lives in the
 * captured overlay; relays stop/pause/resume/restart/discard to the studio recorder via
 * the service worker, and toggles the on-page blur / draw / camera tools locally.
 */
import { root, el, fmt, makeDraggable, ICONS } from "./overlay.js";
import { sendMessage } from "../lib/messages.js";
import { toggleBlur, isBlurArmed, hasBlurRegions } from "./blur.js";
import { toggleDraw, isDrawing } from "./draw.js";

export interface DockHandlers {
  isCameraOn: () => boolean;
  toggleCamera: () => Promise<boolean> | boolean;
}

interface DockState {
  active: boolean;
  state: "recording" | "paused";
  elapsedMs: number;
}

let dockEl: HTMLElement | null = null;
let handlers: DockHandlers | null = null;
let state: DockState = { active: false, state: "recording", elapsedMs: 0 };
let since = performance.now();
let timer: number | null = null;

let pauseBtn: HTMLButtonElement;
let blurBtn: HTMLButtonElement;
let drawBtn: HTMLButtonElement;
let camBtn: HTMLButtonElement;

function build(): HTMLElement {
  const dock = el("div", "fc-dock");

  const stop = el("button", "fc-dock-stop", ICONS.stop);
  stop.title = "Stop & save";
  stop.addEventListener("click", () => void sendMessage({ type: "RECORDING_CONTROL", action: "stop" }));

  const time = el("div", "fc-dock-time", `<span class="fc-dock-dot"></span><span class="fc-dock-clock">0:00</span>`);

  pauseBtn = btn(ICONS.pause, "Pause", () =>
    sendMessage({ type: "RECORDING_CONTROL", action: state.state === "recording" ? "pause" : "resume" }),
  );
  const restart = btn(ICONS.restart, "Restart take", () => sendMessage({ type: "RECORDING_CONTROL", action: "restart" }));
  const trash = btn(ICONS.trash, "Discard", () => sendMessage({ type: "RECORDING_CONTROL", action: "cancel" }));
  trash.classList.add("danger");

  const sep = el("div", "fc-dock-sep");

  blurBtn = btn(ICONS.blur, "Blur sensitive areas", () => {
    toggleBlur();
    render();
  });
  drawBtn = btn(ICONS.pen, "Draw on the page", () => {
    toggleDraw();
    render();
  });
  camBtn = btn(ICONS.cam, "Toggle camera", async () => {
    if (handlers) await handlers.toggleCamera();
    render();
  });

  const grip = btn(ICONS.grip, "Drag");

  dock.append(stop, time, pauseBtn, restart, trash, sep, blurBtn, drawBtn, camBtn, grip);
  makeDraggable(dock, grip);
  return dock;
}

function btn(icon: string, title: string, onClick?: () => unknown): HTMLButtonElement {
  const b = el("button", "fc-btn", icon);
  b.title = title;
  if (onClick) b.addEventListener("click", () => void onClick());
  return b;
}

function render(): void {
  if (!dockEl) return;
  dockEl.classList.toggle("show", state.active);

  const dot = dockEl.querySelector<HTMLElement>(".fc-dock-dot");
  if (dot) {
    const rec = state.state === "recording";
    dot.style.background = rec ? "#38C6DD" : "#F59E0B";
    dot.style.animation = rec ? "fc-pulse 1.2s infinite" : "none";
  }
  pauseBtn.innerHTML = state.state === "recording" ? ICONS.pause : ICONS.play;
  pauseBtn.title = state.state === "recording" ? "Pause" : "Resume";

  blurBtn.classList.toggle("active", isBlurArmed() || hasBlurRegions());
  drawBtn.classList.toggle("active", isDrawing());
  const camOn = handlers?.isCameraOn() ?? false;
  camBtn.classList.toggle("active", camOn);
  camBtn.innerHTML = camOn ? ICONS.cam : ICONS.camOff;

  tick();
}

function tick(): void {
  if (!dockEl) return;
  const clock = dockEl.querySelector<HTMLElement>(".fc-dock-clock");
  if (!clock) return;
  const extra = state.state === "recording" ? performance.now() - since : 0;
  clock.textContent = fmt(state.elapsedMs + extra);
}

export function initDock(h: DockHandlers): void {
  handlers = h;
  if (!dockEl) {
    dockEl = build();
    root().appendChild(dockEl);
  }
}

/** Push new recording state from the service worker; starts/stops the local ticker. */
export function setDockState(s: DockState): void {
  state = s;
  since = performance.now();
  render();
  if (s.active && timer == null) timer = window.setInterval(tick, 250);
  if (!s.active && timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Reflect external tool changes (e.g. camera toggled elsewhere) on the dock. */
export function refreshDock(): void {
  render();
}
