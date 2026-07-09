/**
 * Recorder launcher panel — runs as an EXTENSION-ORIGIN iframe injected into the active
 * tab by the content script (like Loom). Because it's the extension origin, camera + mic
 * permissions are granted once and persist, so it can show a live camera preview, a live
 * mic level meter, and device pickers with real names — none of which the page-injected
 * DOM panel could do.
 *
 * Talks to the service worker via chrome.runtime (start recording / screenshot / whiteboard)
 * and to its host content script via window.parent.postMessage (arm blur / close / resize).
 */
import { StorageProvider } from "@flowcap/shared";
import { getSettings, setSettings, type Settings, type CameraEffect, type CameraFilter } from "../lib/storage.js";
import { CameraCompositor, type EffectConfig } from "../camera/effects.js";
import { blockMessage, providerLabel, resolveDestination, type DestinationState } from "../lib/destination.js";
import { sendMessage } from "../lib/messages.js";
import { api } from "../lib/api.js";
import { config } from "../config.js";

type Surface = "screen" | "window" | "tab";

const I = {
  home: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6.5 8 6.5M6 9.5V19h12V9.5"/></svg>`,
  video: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10l5-2.6v9.2l-5-2.6"/></svg>`,
  shot: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2.5v5M2.5 7.5h5M16.5 21.5v-5M21.5 16.5h-5"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/></svg>`,
  x: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  screen: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 20.5h7M12 17.5v3"/></svg>`,
  window: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 8.5h18"/></svg>`,
  tab: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h5l1.5 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`,
  cam: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10l5-2.6v9.2l-5-2.6"/></svg>`,
  camOff: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5l18 18M15.5 10l5-2.6v9.2M10.5 6H5a2.5 2.5 0 0 0-2.5 2.5V16A2.5 2.5 0 0 0 5 18.5h8"/></svg>`,
  mic: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4M8.5 21.5h7"/></svg>`,
  micOff: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5.2A3 3 0 0 1 15 6v4M15 13.3a3 3 0 0 1-4.4 1.3M5.5 11a6.5 6.5 0 0 0 10 5.4M12 17.5v4M8.5 21.5h7M3.5 3.5l17 17"/></svg>`,
  chev: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  effects: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/></svg>`,
  blur: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" stroke-dasharray="2.2 3"/><circle cx="12" cy="12" r="3.4"/></svg>`,
  pen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5l4 4M4 20l1.2-4.2L16 5a2 2 0 0 1 3 3L8.2 18.8 4 20Z"/></svg>`,
  more: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`,
  cloud: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.9 9.6 4.5 4.5 0 0 0 7 18.5Z"/></svg>`,
  lock: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>`,
};

const SURFACES: { id: Surface; icon: string; label: string }[] = [
  { id: "screen", icon: I.screen, label: "Full screen" },
  { id: "window", icon: I.window, label: "Window" },
  { id: "tab", icon: I.tab, label: "Current tab" },
];

let settings: Settings;
let surface: Surface = "screen";
let surfaceOpen = false;
let openSection: "effects" | "more" | null = null;
let cameras: MediaDeviceInfo[] = [];
let mics: MediaDeviceInfo[] = [];

// ── destination pre-flight (null until the async check lands) ──
let dest: DestinationState | null = null;
let destOpen = false;
let connecting: StorageProvider | null = null;
let destError: string | null = null;

const head = document.getElementById("head")!;
const controls = document.getElementById("controls")!;
const preview = document.getElementById("preview") as HTMLElement;
const video = document.getElementById("v") as HTMLVideoElement;
const canvas = document.getElementById("cam") as HTMLCanvasElement;

// ── media (persist across re-renders so the preview never flashes) ──
let camStream: MediaStream | null = null;
let compositor: CameraCompositor | null = null;
let micStream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let meterRaf = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function effectCfg(): EffectConfig {
  return { effect: settings.cameraEffect, filter: settings.cameraFilter, bgColor: settings.cameraBgColor, bgImage: settings.cameraBgImage };
}

// ── parent (content script) + service worker messaging ──
function toParent(type: string, extra: Record<string, unknown> = {}): void {
  window.parent.postMessage({ __vyooom: true, type, ...extra }, "*");
}
function reportHeight(): void {
  const h = document.getElementById("panel")!.offsetHeight;
  toParent("height", { height: h });
}

// ── camera ──
async function startCam(): Promise<void> {
  try {
    const next = await navigator.mediaDevices.getUserMedia({
      video: settings.cameraDeviceId ? { deviceId: { exact: settings.cameraDeviceId } } : { facingMode: "user" },
      audio: false,
    });
    camStream?.getTracks().forEach((t) => t.stop());
    camStream = next;
    video.srcObject = next;
    await video.play().catch(() => {});
    if (!compositor) compositor = new CameraCompositor(video, canvas);
    compositor.setEffect(effectCfg());
    compositor.start();
    preview.hidden = false;
    await refreshDevices();
  } catch {
    preview.hidden = true;
  }
}
function stopCam(): void {
  compositor?.stop();
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  preview.hidden = true;
}

// ── mic + live level meter ──
async function startMic(): Promise<void> {
  try {
    const next = await navigator.mediaDevices.getUserMedia({
      audio: settings.micDeviceId ? { deviceId: { exact: settings.micDeviceId } } : true,
    });
    stopMic();
    micStream = next;
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(next);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      const fill = document.getElementById("mic-fill");
      if (fill) fill.style.width = `${Math.min(100, (peak / 90) * 100)}%`;
      meterRaf = requestAnimationFrame(loop);
    };
    loop();
    await refreshDevices();
  } catch {
    /* mic denied — stay off */
  }
}
function stopMic(): void {
  cancelAnimationFrame(meterRaf);
  micStream?.getTracks().forEach((t) => t.stop());
  void audioCtx?.close();
  micStream = null;
  audioCtx = null;
}

async function refreshDevices(): Promise<void> {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    cameras = devs.filter((d) => d.kind === "videoinput" && d.deviceId);
    mics = devs.filter((d) => d.kind === "audioinput" && d.deviceId);
    renderControls();
  } catch {
    /* ignore */
  }
}

function save(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  void setSettings(patch);
}

// ── rendering (head once; controls rebuilt — preview element persists) ──
function renderHead(): void {
  const home = el("button", "hbtn", I.home);
  home.title = "Close";
  home.onclick = () => toParent("close");
  const tabs = el("div", "tabs");
  const vTab = el("button", "tab active", I.video);
  vTab.title = "Record";
  const sTab = el("button", "tab", I.shot);
  sTab.title = "Screenshot";
  sTab.onclick = () => {
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
    toParent("close");
  };
  tabs.append(vTab, sTab);
  const x = el("button", "x", I.x);
  x.onclick = () => toParent("close");
  head.replaceChildren(home, tabs, x);
  // The header is the drag handle; report press to the parent, which moves the iframe
  // (a transparent overlay in the page captures the moves the iframe would swallow).
  head.onpointerdown = (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    toParent("drag-start", { x: e.screenX, y: e.screenY });
  };
  // A press that ends without leaving the header (a plain click) never reaches the
  // page overlay — tell the parent to drop it so the overlay can't get stuck.
  head.onpointerup = () => toParent("drag-end");
}

function srow(icon: string, txt: string, right: HTMLElement, onClick?: () => void): HTMLElement {
  const row = el("button", "srow");
  row.append(el("span", "ico", icon), el("span", "txt", txt), right);
  if (onClick) row.onclick = onClick;
  return row;
}
function pill(on: boolean): HTMLElement {
  return el("span", `pill ${on ? "on" : "off"}`, on ? "On" : "Off");
}

function deviceSelect(list: MediaDeviceInfo[], current: string, kind: string, onPick: (id: string) => void): HTMLElement {
  const wrap = el("div", "devrow");
  const sel = el("select");
  const def = el("option");
  def.value = "";
  def.textContent = `Default ${kind}`;
  sel.append(def);
  for (const d of list) {
    const o = el("option");
    o.value = d.deviceId;
    o.textContent = d.label || `${kind} ${list.indexOf(d) + 1}`;
    if (d.deviceId === current) o.selected = true;
    sel.append(o);
  }
  sel.onchange = () => onPick(sel.value);
  wrap.append(sel);
  return wrap;
}

// ── destination (where the capture uploads) ──
async function refreshDestination(): Promise<void> {
  try {
    dest = await resolveDestination();
  } catch {
    dest = null; // check itself failed — don't block; the SW re-checks on start
  }
  renderControls();
}

function connState(provider: StorageProvider): "off" | "active" | "broken" {
  if (!dest) return "off";
  return provider === StorageProvider.DRIVE ? dest.drive : dest.dropbox;
}

function destIcon(provider: StorageProvider): string {
  if (provider === StorageProvider.DRIVE) return `<img class="pico" src="/assets/drive.png" alt="" />`;
  if (provider === StorageProvider.DROPBOX) return `<img class="pico" src="/assets/dropbox.png" alt="" />`;
  return I.cloud;
}

async function chooseDest(provider: StorageProvider): Promise<void> {
  save({ destination: provider });
  destOpen = false;
  destError = null;
  api.setDefaultProvider(provider).catch(() => {}); // best-effort server sync
  await refreshDestination();
}

/** Run the OAuth connect flow in the SW (it survives this panel), then adopt the provider. */
async function connectProvider(provider: StorageProvider): Promise<void> {
  if (connecting) return;
  connecting = provider;
  destError = null;
  renderControls();
  try {
    const res = await sendMessage({
      type: provider === StorageProvider.DRIVE ? "CONNECT_DRIVE" : "CONNECT_DROPBOX",
    });
    if (!res.ok) throw new Error(res.error);
    save({ destination: provider });
    destOpen = false;
  } catch (err) {
    destError = err instanceof Error ? err.message : "Connection failed.";
  }
  connecting = null;
  await refreshDestination();
}

function destOption(provider: StorageProvider): HTMLElement {
  const d = dest!;
  const label = providerLabel(provider);
  const b = el("button", `surf-opt${provider === d.provider ? " active" : ""}`);

  let tag = "";
  let onClick: () => void;
  if (provider === StorageProvider.FLOWCAP && !d.hostedStorage) {
    tag = `<span class="tag">${I.lock} Premium</span>`;
    onClick = () => window.open(`${config.webBaseUrl}/pricing`, "_blank");
  } else if (provider !== StorageProvider.FLOWCAP && connState(provider) !== "active") {
    const verb = connState(provider) === "broken" ? "Reconnect" : "Connect";
    tag = `<span class="tag go">${connecting === provider ? "Connecting…" : verb}</span>`;
    onClick = () => void connectProvider(provider);
  } else {
    onClick = () => void chooseDest(provider);
  }

  b.innerHTML = `<span class="ico">${destIcon(provider)}</span><span>${label}</span>${tag}`;
  b.onclick = onClick;
  return b;
}

function warnBox(d: DestinationState): HTMLElement {
  const box = el("div", "warn");
  const msg = el("span");
  msg.textContent = blockMessage(d);
  box.append(msg);

  const actions = el("div", "warn-actions");
  if (d.block === "locked") {
    const c = el("button", "warn-btn", connecting === StorageProvider.DRIVE ? "Connecting…" : "Connect Google Drive");
    c.onclick = () => void connectProvider(StorageProvider.DRIVE);
    const up = el("button", "warn-btn ghost", "Upgrade");
    up.onclick = () => window.open(`${config.webBaseUrl}/pricing`, "_blank");
    actions.append(c, up);
  } else if ((d.block === "not-connected" || d.block === "reconnect") && d.provider !== StorageProvider.FLOWCAP) {
    const verb = d.block === "reconnect" ? "Reconnect" : "Connect";
    const c = el("button", "warn-btn", connecting === d.provider ? "Connecting…" : `${verb} ${providerLabel(d.provider)}`);
    c.onclick = () => void connectProvider(d.provider);
    actions.append(c);
  }
  if (actions.childElementCount) box.append(actions);
  return box;
}

/** "Save to …" row + expandable provider menu + blocking warning. Always visible:
 *  saying where the bytes go is the product promise, not a settings detail. */
function destinationSection(frag: DocumentFragment): void {
  const provider = dest?.provider ?? settings.destination;
  const blocked = dest != null && !dest.ok;

  const right = blocked ? el("span", "pill fix", "Fix") : el("span", "chev", I.chev);
  frag.append(
    srow(destIcon(provider), `Save to ${providerLabel(provider)}`, right, () => {
      destOpen = !destOpen;
      renderControls();
    }),
  );

  if (destOpen && dest) {
    const menu = el("div", "surf-menu");
    menu.append(
      destOption(StorageProvider.DRIVE),
      destOption(StorageProvider.DROPBOX),
      destOption(StorageProvider.FLOWCAP),
    );
    frag.append(menu);
  }

  if (dest?.ok && dest.switched) {
    frag.append(
      el("div", "fx-label", `Switched to ${providerLabel(dest.provider)} — your saved destination wasn't available.`),
    );
  }
  if (blocked && dest) frag.append(warnBox(dest));
  if (destError) {
    const e = el("div", "warn");
    e.textContent = destError;
    frag.append(e);
  }
}

function renderControls(): void {
  const frag = document.createDocumentFragment();

  // Surface selector.
  const cur = SURFACES.find((x) => x.id === surface) ?? SURFACES[0]!;
  frag.append(
    srow(cur.icon, cur.label, el("span", "chev", I.chev), () => {
      surfaceOpen = !surfaceOpen;
      renderControls();
    }),
  );
  if (surfaceOpen) {
    const menu = el("div", "surf-menu");
    for (const opt of SURFACES) {
      const b = el("button", `surf-opt${opt.id === surface ? " active" : ""}`, `<span class="ico">${opt.icon}</span><span>${opt.label}</span>`);
      b.onclick = () => {
        surface = opt.id;
        surfaceOpen = false;
        renderControls();
      };
      menu.append(b);
    }
    frag.append(menu);
  }

  // Camera row (+ device picker when on).
  frag.append(
    srow(settings.camera ? I.cam : I.camOff, settings.camera ? "Camera" : "No camera", pill(settings.camera), () => {
      const on = !settings.camera;
      save({ camera: on });
      if (on) void startCam();
      else stopCam();
      renderControls();
    }),
  );
  if (settings.camera && cameras.length > 1) {
    frag.append(
      deviceSelect(cameras, settings.cameraDeviceId, "camera", (id) => {
        save({ cameraDeviceId: id });
        void startCam();
      }),
    );
  }

  // Mic row (+ device picker + live meter when on).
  frag.append(
    srow(settings.microphone ? I.mic : I.micOff, settings.microphone ? "Microphone" : "Muted", pill(settings.microphone), () => {
      const on = !settings.microphone;
      save({ microphone: on });
      if (on) void startMic();
      else stopMic();
      renderControls();
    }),
  );
  if (settings.microphone) {
    if (mics.length > 1) {
      frag.append(
        deviceSelect(mics, settings.micDeviceId, "mic", (id) => {
          save({ micDeviceId: id });
          void startMic();
        }),
      );
    }
    frag.append(el("div", "meter", `<i id="mic-fill"></i>`));
  }

  // Destination (always disclosed; blocks Start when unusable).
  destinationSection(frag);
  const blocked = dest != null && !dest.ok;

  // Start + pencil.
  const startRow = el("div", "start-row");
  const start = el("button", "start", `${I.video} Start recording`);
  start.disabled = blocked;
  start.onclick = () => {
    if (blocked) return;
    chrome.runtime.sendMessage({ type: "START_RECORDING", surface });
    toParent("close");
  };
  const pencil = el("button", "pencil", I.pen);
  pencil.title = "Whiteboard";
  pencil.onclick = () => {
    chrome.runtime.sendMessage({ type: "OPEN_STUDIO", mode: "whiteboard" });
    toParent("close");
  };
  startRow.append(start, pencil);
  frag.append(startRow);

  // Footer.
  const foot = el("div", "foot");
  const fx = el("button", openSection === "effects" ? "active" : "", `${I.effects}<span>Effects</span>`);
  fx.onclick = () => {
    openSection = openSection === "effects" ? null : "effects";
    renderControls();
  };
  const blur = el("button", "", `${I.blur}<span>Blur</span>`);
  // Don't close — the host collapses this panel while you blur and restores it after,
  // so you land right back here to hit Start (previously the panel vanished for good).
  blur.onclick = () => toParent("arm-blur");
  const more = el("button", openSection === "more" ? "active" : "", `${I.more}<span>More</span>`);
  more.onclick = () => {
    openSection = openSection === "more" ? null : "more";
    renderControls();
  };
  foot.append(fx, blur, more);
  frag.append(foot);

  if (openSection === "effects") frag.append(effectsSection());
  if (openSection === "more") frag.append(moreSection());

  controls.replaceChildren(frag);
  reportHeight();
}

function chipGrid(cols: number, items: [string, string][], active: string, onPick: (id: string) => void): HTMLElement {
  const grid = el("div", "chips");
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  for (const [id, label] of items) {
    const c = el("button", `chip${active === id ? " active" : ""}`, label);
    c.onclick = () => {
      onPick(id);
      grid.querySelectorAll(".chip").forEach((n) => n.classList.toggle("active", n === c));
    };
    grid.append(c);
  }
  return grid;
}

function effectsSection(): HTMLElement {
  const wrap = el("div", "fx");
  if (!settings.camera) wrap.append(el("div", "fx-label", "Turn the camera on to use background effects"));
  wrap.append(el("div", "fx-label", "Background"));
  wrap.append(
    chipGrid(
      4,
      [
        ["none", "None"],
        ["blur", "Blur"],
        ["image", "Scene"],
        ["color", "Color"],
      ] as [CameraEffect, string][],
      settings.cameraEffect,
      (id) => {
        save({ cameraEffect: id as CameraEffect });
        compositor?.setEffect(effectCfg());
      },
    ),
  );
  wrap.append(el("div", "fx-label", "Filter"));
  wrap.append(
    chipGrid(
      3,
      [
        ["none", "Normal"],
        ["touchup", "Touch up"],
        ["mono", "Mono"],
        ["warm", "Warm"],
        ["cool", "Cool"],
        ["vivid", "Vivid"],
      ] as [CameraFilter, string][],
      settings.cameraFilter,
      (id) => {
        save({ cameraFilter: id as CameraFilter });
        compositor?.setEffect(effectCfg());
      },
    ),
  );
  return wrap;
}

function moreSection(): HTMLElement {
  const wrap = el("div", "fx");
  const row = srow("", "Countdown (3-2-1)", pill(settings.countdown), () => {
    const on = !settings.countdown;
    save({ countdown: on });
    const p = row.querySelector(".pill");
    if (p) {
      p.className = `pill ${on ? "on" : "off"}`;
      p.textContent = on ? "On" : "Off";
    }
  });
  (row.querySelector(".ico") as HTMLElement).remove();
  wrap.append(row);
  wrap.append(el("div", "fx-label", "Blur, draw & camera live in the on-page dock while you record."));
  return wrap;
}

// ── boot ──
async function init(): Promise<void> {
  settings = await getSettings();
  renderHead();
  renderControls();
  void refreshDestination(); // async — re-renders with the pre-flight result
  if (settings.camera) await startCam();
  if (settings.microphone) await startMic();
  new ResizeObserver(() => reportHeight()).observe(document.getElementById("panel")!);
}
void init();

window.addEventListener("pagehide", () => {
  stopCam();
  stopMic();
});
