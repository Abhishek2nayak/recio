import { getRecents, getSettings, saveSettings } from "../lib/store.js";
import { isCloudConnected, formatDuration } from "../lib/publish.js";

const $ = (sel) => document.querySelector(sel);

function send(msg) { return chrome.runtime.sendMessage(msg); }

// ── Selected recording source ─────────────────────────────────────────
let selectedMode = "screen";

// ── Tab switching ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-icon[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tab;
      document.querySelectorAll(".tab-icon").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab${capitalize(id)}`).classList.add("active");
    });
  });
}

function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }

// ── Source tabs ───────────────────────────────────────────────────────
function initSourceTabs() {
  document.querySelectorAll(".source-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedMode = btn.dataset.mode;
      document.querySelectorAll(".source-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// ── Device pill toggles ───────────────────────────────────────────────
async function initDeviceToggles() {
  const s = await getSettings();

  // Camera: webcamMode !== "off" means camera is "on"
  const camOn = s.webcamMode !== "off";
  setPill($("#camToggle"), camOn);
  $("#camToggle").addEventListener("click", async () => {
    const cur = await getSettings();
    const next = cur.webcamMode === "off" ? "pip" : "off";
    await saveSettings({ webcamMode: next });
    setPill($("#camToggle"), next !== "off");
  });

  // Mic
  setPill($("#micToggle"), s.includeMic);
  $("#micToggle").addEventListener("click", async () => {
    const cur = await getSettings();
    const next = !cur.includeMic;
    await saveSettings({ includeMic: next });
    setPill($("#micToggle"), next);
  });
}

function setPill(btn, on) {
  btn.textContent = on ? "On" : "Off";
  btn.className = on ? "pill on" : "pill off";
}

// ── Start recording ───────────────────────────────────────────────────
async function startRecording() {
  // If the selected mode is camera-only, use it regardless of camera toggle.
  // For screen/screen-cam, honour the camera pill to decide between screen and screen-cam.
  let mode = selectedMode;
  if (mode === "screen") {
    const s = await getSettings();
    if (s.webcamMode !== "off") mode = "screen-cam";
  }
  await send({ type: "OPEN_STUDIO", mode });
  window.close();
}

// ── Screenshot actions ────────────────────────────────────────────────
async function triggerAreaShot() {
  const res = await send({ type: "CAPTURE_SCREENSHOT", mode: "area" });
  if (res && res.ok === false) alert(res.error || "Could not inject area selector. Try a regular website tab.");
  window.close();
}

async function triggerFullShot() {
  const res = await send({ type: "CAPTURE_SCREENSHOT", mode: "full" });
  if (res && res.ok === false) alert(res.error || "Screenshot failed.");
  window.close();
}

// ── Cloud status ──────────────────────────────────────────────────────
async function renderCloudStatus() {
  const dot = $("#cloudDot");
  const label = $("#cloudLabel");
  try {
    const connected = await isCloudConnected();
    dot.className = connected ? "dot-sm on" : "dot-sm off";
    label.textContent = connected ? "Drive connected" : "Connect Drive";
  } catch {
    dot.className = "dot-sm off";
    label.textContent = "Connect Drive";
  }
}

// ── Recents ───────────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

async function renderRecents() {
  const list = await getRecents();
  const ul = $("#recentList");
  const empty = $("#recentEmpty");
  const count = $("#recentCount");
  count.textContent = list.length ? `${list.length}` : "";

  if (!list.length) {
    ul.style.display = "none";
    empty.style.display = "";
    return;
  }
  empty.style.display = "none";

  for (const r of list.slice(0, 10)) {
    const li = document.createElement("li");
    li.className = "recent";

    const thumb = document.createElement("div");
    thumb.className = "recent-thumb";
    if (r.thumbnail) thumb.style.backgroundImage = `url(${r.thumbnail})`;
    else thumb.textContent = r.type === "image" ? "🖼️" : "▶️";

    const meta = document.createElement("div");
    meta.className = "recent-meta";
    const title = document.createElement("span");
    title.className = "recent-title";
    title.textContent = r.title;
    const info = document.createElement("span");
    info.className = "recent-info";
    const dur = r.type === "video" && r.durationMs ? ` · ${formatDuration(r.durationMs)}` : "";
    info.textContent = `${timeAgo(r.createdAt)}${dur}`;
    meta.append(title, info);

    const copy = document.createElement("button");
    copy.className = "recent-copy";
    copy.textContent = "Copy";
    copy.addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(r.viewUrl);
      copy.textContent = "✓";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    });

    li.addEventListener("click", () => chrome.tabs.create({ url: r.viewUrl }));
    li.append(thumb, meta, copy);
    ul.appendChild(li);
  }
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  const settings = await getSettings();

  // Pre-select the mode tab that matches saved settings.
  selectedMode =
    settings.webcamMode === "only" ? "camera" :
    settings.webcamMode === "pip"  ? "screen-cam" : "screen";
  document.querySelectorAll(".source-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === selectedMode);
  });

  initTabs();
  initSourceTabs();
  await initDeviceToggles();

  $("#startRecordBtn").addEventListener("click", startRecording);
  $("#shotBtn").addEventListener("click", triggerAreaShot);
  $("#fullShotBtn").addEventListener("click", triggerFullShot);
  $("#settingsBtn").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });
  $("#cloudStatusBtn").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });

  renderCloudStatus();
  renderRecents();
}

init();
