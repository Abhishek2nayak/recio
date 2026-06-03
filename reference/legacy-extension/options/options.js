import { getSettings, saveSettings } from "../lib/store.js";
import { getProvider } from "../providers/provider.js";
import "../providers/google-drive.js";
import "../providers/dropbox.js";

const $ = (s) => document.querySelector(s);

const FIELDS = {
  videoQuality: "value",
  webcamMode: "value",
  countdownSeconds: "value",
  defaultLinkAccess: "value",
  includeMic: "checked",
  includeSystemAudio: "checked",
  autoCopyLink: "checked",
  providerSelect: "value",
};

async function init() {
  if (new URLSearchParams(location.search).get("welcome")) {
    $("#welcome").classList.remove("hidden");
  }

  const s = await getSettings();
  $("#videoQuality").value = s.videoQuality;
  $("#webcamMode").value = s.webcamMode;
  $("#countdownSeconds").value = String(s.countdownSeconds);
  $("#defaultLinkAccess").value = s.defaultLinkAccess;
  $("#includeMic").checked = s.includeMic;
  $("#includeSystemAudio").checked = s.includeSystemAudio;
  $("#autoCopyLink").checked = s.autoCopyLink;
  $("#providerSelect").value = s.provider;

  wire();
  refreshCloud();
}

function wire() {
  const persist = async () => {
    await saveSettings({
      videoQuality: $("#videoQuality").value,
      webcamMode: $("#webcamMode").value,
      countdownSeconds: Number($("#countdownSeconds").value),
      defaultLinkAccess: $("#defaultLinkAccess").value,
      includeMic: $("#includeMic").checked,
      includeSystemAudio: $("#includeSystemAudio").checked,
      autoCopyLink: $("#autoCopyLink").checked,
      provider: $("#providerSelect").value,
    });
    flashSaved();
  };

  for (const id of Object.keys(FIELDS)) {
    $("#" + id).addEventListener("change", persist);
  }

  $("#connectBtn").addEventListener("click", connect);
  $("#disconnectBtn").addEventListener("click", disconnect);
  $("#providerSelect").addEventListener("change", refreshCloud);
}

function activeProvider() {
  return getProvider($("#providerSelect").value);
}

function setStatusText(msg) {
  // Write to both elements so CSS can show whichever is visible.
  const t1 = $("#statusText");
  const t2 = $("#statusTextBadge");
  if (t1) t1.textContent = msg;
  if (t2) t2.textContent = msg;
}

async function refreshCloud() {
  const dot = $("#statusDot");
  const connectBtn = $("#connectBtn");
  const disconnectBtn = $("#disconnectBtn");
  hide($("#cloudError"));

  const provider = activeProvider();
  let connected = false;
  try {
    connected = await provider.isConnected();
  } catch {
    connected = false;
  }

  if (connected) {
    const account = await provider.getAccount().catch(() => null);
    dot.className = "dot on";
    setStatusText(account ? account.email : "Connected");
    connectBtn.classList.add("hidden");
    disconnectBtn.classList.remove("hidden");
  } else {
    dot.className = "dot off";
    setStatusText("Not connected");
    connectBtn.classList.remove("hidden");
    disconnectBtn.classList.add("hidden");
  }
}

async function connect() {
  const btn = $("#connectBtn");
  btn.disabled = true;
  btn.textContent = "Connecting…";
  hide($("#cloudError"));
  try {
    await activeProvider().connect();
    await refreshCloud();
  } catch (err) {
    showError(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Connect";
  }
}

async function disconnect() {
  const btn = $("#disconnectBtn");
  btn.disabled = true;
  try {
    await activeProvider().disconnect();
    await refreshCloud();
  } catch (err) {
    showError(err);
  } finally {
    btn.disabled = false;
  }
}

function flashSaved() {
  const note = $("#savedNote");
  note.classList.add("show");
  setTimeout(() => note.classList.remove("show"), 1200);
}
function showError(err) {
  const el = $("#cloudError");
  el.textContent = err.message;
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

init();
