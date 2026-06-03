import { getSettings, saveSettings } from "../lib/store.js";
import { publish, formatBytes, formatDuration } from "../lib/publish.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "screen"; // screen | screen-cam | camera

const MODE_META = {
  screen:       { title: "Record your screen",   sub: "Pick a tab, window, or your whole screen." },
  "screen-cam": { title: "Screen + camera",       sub: "Your screen with a camera bubble in the corner." },
  camera:       { title: "Camera only",           sub: "Record yourself talking to the lens." },
};

const live = {
  displayStream: null,
  camStream: null,
  micStream: null,
  recordStream: null,
  audioCtx: null,
  rafId: null,
};

let recorder = null;
let chunks = [];
let startedAt = 0;
let elapsedBeforePause = 0;
let timerId = null;
let resultBlob = null;
let resultDurationMs = 0;
let thumbnail = null;

// ---------- init ----------
async function init() {
  const meta = MODE_META[mode] || MODE_META.screen;
  $("#modeTitle").textContent = meta.title;
  $("#modeSub").textContent = meta.sub;

  const settings = await getSettings();
  $("#optMic").checked = settings.includeMic;
  $("#optSysAudio").checked = settings.includeSystemAudio;
  $("#optQuality").value = settings.videoQuality;

  // System audio toggle is irrelevant for camera-only mode.
  // Use the correct class from the new HTML (.opt-toggle).
  const sysAudioLabel = $("#optSysAudio").closest(".opt-toggle");
  if (sysAudioLabel) sysAudioLabel.style.display = mode === "camera" ? "none" : "";

  // Pre-roll camera for screen-cam and camera-only so user can frame themselves.
  if (mode === "camera" || mode === "screen-cam") {
    try {
      live.camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const v = $("#preview");
      v.srcObject = live.camStream;
      v.classList.remove("hidden");
      const ph = $("#previewPlaceholder");
      if (ph) ph.classList.add("hidden");
    } catch {
      /* framing preview is best-effort */
    }
  }

  wire();
}

function wire() {
  $("#startBtn").addEventListener("click", () => startFlow().catch(showSetupError));
  $("#stopBtn").addEventListener("click", stopRecording);
  $("#pauseBtn").addEventListener("click", togglePause);
  $("#saveBtn").addEventListener("click", () => saveToCloud().catch(showReviewError));
  $("#downloadBtn").addEventListener("click", downloadResult);
  $("#againBtn").addEventListener("click", () => location.reload());
  $("#copyLinkBtn").addEventListener("click", copyLink);

  $("#optMic").addEventListener("change", (e) => saveSettings({ includeMic: e.target.checked }));
  $("#optSysAudio").addEventListener("change", (e) => saveSettings({ includeSystemAudio: e.target.checked }));
  $("#optQuality").addEventListener("change", (e) => saveSettings({ videoQuality: e.target.value }));
}

function qualityConstraints() {
  const q = $("#optQuality").value;
  if (q === "source") return { frameRate: { ideal: 30 } };
  const h = q === "720p" ? 720 : 1080;
  return { width: { ideal: (h * 16) / 9 }, height: { ideal: h }, frameRate: { ideal: 30 } };
}

// ---------- media acquisition ----------
// IMPORTANT: getDisplayMedia() must be the very first await after a user gesture.
// acquireStreams() is structured so getDisplayMedia() is the first call for all
// screen modes. Do not add any awaits before calling acquireStreams() in startFlow().
async function acquireStreams() {
  const wantMic = $("#optMic").checked;
  const wantSysAudio = $("#optSysAudio").checked;

  if (mode === "camera") {
    live.camStream =
      live.camStream ||
      (await navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
    if (wantMic) live.micStream = await getMic();
    return buildCameraStream();
  }

  // For screen and screen-cam, getDisplayMedia() is the FIRST await.
  live.displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: qualityConstraints(),
    audio: wantSysAudio,
  });
  live.displayStream.getVideoTracks()[0].addEventListener("ended", () => {
    if (recorder && recorder.state !== "inactive") stopRecording();
  });

  if (wantMic) live.micStream = await getMic();

  if (mode === "screen-cam") {
    live.camStream =
      live.camStream ||
      (await navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
    return buildPipStream();
  }
  return buildScreenStream();
}

async function getMic() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
  } catch {
    return null;
  }
}

function mixAudio(streams) {
  const withAudio = streams.filter((s) => s && s.getAudioTracks().length);
  if (!withAudio.length) return null;
  if (withAudio.length === 1) return withAudio[0].getAudioTracks()[0];
  live.audioCtx = new AudioContext();
  const dest = live.audioCtx.createMediaStreamDestination();
  for (const s of withAudio) live.audioCtx.createMediaStreamSource(s).connect(dest);
  return dest.stream.getAudioTracks()[0];
}

function buildScreenStream() {
  const out = new MediaStream();
  out.addTrack(live.displayStream.getVideoTracks()[0]);
  const audio = mixAudio([live.displayStream, live.micStream]);
  if (audio) out.addTrack(audio);
  return out;
}

function buildCameraStream() {
  const out = new MediaStream();
  out.addTrack(live.camStream.getVideoTracks()[0]);
  const audio = mixAudio([live.micStream]);
  if (audio) out.addTrack(audio);
  return out;
}

function buildPipStream() {
  const screenVideo = document.createElement("video");
  screenVideo.srcObject = live.displayStream;
  screenVideo.muted = true;
  screenVideo.play();

  const camVideo = document.createElement("video");
  camVideo.srcObject = live.camStream;
  camVideo.muted = true;
  camVideo.play();

  const track = live.displayStream.getVideoTracks()[0].getSettings();
  const W = track.width || 1280;
  const H = track.height || 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bubble = Math.round(Math.min(W, H) * 0.22);
  const margin = Math.round(bubble * 0.18);

  const draw = () => {
    ctx.drawImage(screenVideo, 0, 0, W, H);
    const cx = margin + bubble / 2;
    const cy = H - margin - bubble / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, bubble / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const cw = camVideo.videoWidth || 640;
    const ch = camVideo.videoHeight || 480;
    const scale = Math.max(bubble / cw, bubble / ch);
    const dw = cw * scale;
    const dh = ch * scale;
    ctx.drawImage(camVideo, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, bubble / 2, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(3, bubble * 0.03);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    live.rafId = requestAnimationFrame(draw);
  };
  draw();

  const out = canvas.captureStream(30);
  const audio = mixAudio([live.displayStream, live.micStream]);
  if (audio) out.addTrack(audio);
  return out;
}

// ---------- recording lifecycle ----------
function pickMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

async function startFlow() {
  hide($("#setupError"));
  $("#startBtn").disabled = true;

  // ── CRITICAL: getDisplayMedia() must be called within the user-gesture activation
  // window. acquireStreams() calls it as its FIRST async operation. Nothing that
  // consumes the activation (other awaits, timers) may run before this call.
  let recordStream;
  try {
    recordStream = await acquireStreams();
  } catch (err) {
    $("#startBtn").disabled = false;
    throw friendlyMediaError(err);
  }
  live.recordStream = recordStream;

  // Show a live preview while the countdown runs.
  const pv = $("#preview");
  pv.srcObject = live.recordStream;
  pv.classList.remove("hidden");
  const ph = $("#previewPlaceholder");
  if (ph) ph.classList.add("hidden");

  const { countdownSeconds } = await getSettings();
  await countdown(countdownSeconds);
  beginRecorder();
}

// Auto-hide the floating controls after 3 s of mouse inactivity.
let _idleTimer = null;
function startIdleFade() {
  const page = document.querySelector(".page");
  const reset = () => {
    page?.classList.remove("controls-idle");
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => page?.classList.add("controls-idle"), 3000);
  };
  document.addEventListener("mousemove", reset);
  document.addEventListener("keydown", reset);
  reset();
}
function stopIdleFade() {
  clearTimeout(_idleTimer);
  document.querySelector(".page")?.classList.remove("controls-idle");
  document.removeEventListener("mousemove", startIdleFade);
  document.removeEventListener("keydown", startIdleFade);
}

function beginRecorder() {
  chunks = [];
  const mimeType = pickMimeType();
  recorder = new MediaRecorder(live.recordStream, { mimeType, videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  recorder.onstop = onRecorderStop;
  recorder.start(1000);

  startedAt = Date.now();
  elapsedBeforePause = 0;
  $("#setupControls").classList.add("hidden");
  $("#recControls").classList.remove("hidden");
  $("#recBadge").classList.remove("hidden");

  // Expand to fullscreen recording view.
  document.querySelector(".page")?.classList.add("is-recording");
  startIdleFade();

  startTimer();
}

function startTimer() {
  const tick = () => {
    const ms = elapsedBeforePause + (recorder.state === "recording" ? Date.now() - startedAt : 0);
    $("#timer").textContent = formatDuration(ms);
  };
  tick();
  timerId = setInterval(tick, 500);
}

function togglePause() {
  if (!recorder) return;
  if (recorder.state === "recording") {
    recorder.pause();
    elapsedBeforePause += Date.now() - startedAt;
    $("#pauseBtn").innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="3,2 11,7 3,12" fill="currentColor"/></svg> Resume`;
    $("#recBadge").style.opacity = "0.4";
  } else if (recorder.state === "paused") {
    recorder.resume();
    startedAt = Date.now();
    $("#pauseBtn").innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="3.5" height="10" rx="1" fill="currentColor"/><rect x="8.5" y="2" width="3.5" height="10" rx="1" fill="currentColor"/></svg> Pause`;
    $("#recBadge").style.opacity = "1";
  }
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") {
    resultDurationMs =
      elapsedBeforePause + (recorder.state === "recording" ? Date.now() - startedAt : 0);
    recorder.stop();
  }
  clearInterval(timerId);
}

async function onRecorderStop() {
  stopAllTracks();
  const mimeType = recorder.mimeType || "video/webm";
  resultBlob = new Blob(chunks, { type: mimeType });
  thumbnail = await grabThumbnail(resultBlob).catch(() => null);
  showReview();
}

function stopAllTracks() {
  if (live.rafId) cancelAnimationFrame(live.rafId);
  for (const key of ["displayStream", "camStream", "micStream", "recordStream"]) {
    live[key]?.getTracks().forEach((t) => t.stop());
  }
  live.audioCtx?.close().catch(() => {});
}

// ---------- review + publish ----------
function showReview() {
  // Exit fullscreen recording mode before showing the review card.
  document.querySelector(".page")?.classList.remove("is-recording");
  stopIdleFade();
  $("#setupView").classList.add("hidden");
  $("#reviewView").classList.remove("hidden");

  const url = URL.createObjectURL(resultBlob);
  $("#result").src = url;
  $("#titleInput").value = defaultTitle();
  $("#reviewStats").textContent = `${formatDuration(resultDurationMs)} · ${formatBytes(resultBlob.size)} · ${resultBlob.type.split(";")[0]}`;
}

function defaultTitle() {
  const stamp = new Date().toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return `Recording — ${stamp}`;
}

async function saveToCloud() {
  hide($("#reviewError"));
  const saveBtn = $("#saveBtn");
  saveBtn.disabled = true;
  $("#downloadBtn").disabled = true;
  $("#progressWrap").classList.remove("hidden");
  setProgress(0, "Preparing upload…");

  try {
    const item = await publish({
      blob: resultBlob,
      title: $("#titleInput").value.trim() || defaultTitle(),
      type: "video",
      durationMs: resultDurationMs,
      thumbnail,
      onProgress: (p) => setProgress(p, `Uploading… ${Math.round(p * 100)}%`),
    });
    setProgress(1, "Done");
    showShare(item.viewUrl);
  } catch (err) {
    $("#progressWrap").classList.add("hidden");
    showReviewError(err);
  } finally {
    saveBtn.disabled = false;
    $("#downloadBtn").disabled = false;
  }
}

function setProgress(p, label) {
  $("#progressFill").style.width = `${Math.round(p * 100)}%`;
  $("#progressLabel").textContent = label;
}

async function showShare(url) {
  $("#shareWrap").classList.remove("hidden");
  $("#shareLink").value = url;
  $("#openLink").href = url;
  const { autoCopyLink } = await getSettings();
  if (autoCopyLink) {
    await navigator.clipboard.writeText(url).catch(() => {});
    flashCopy();
  }
}

async function copyLink() {
  await navigator.clipboard.writeText($("#shareLink").value);
  flashCopy();
}
function flashCopy() {
  const b = $("#copyLinkBtn");
  b.textContent = "Copied!";
  setTimeout(() => (b.textContent = "Copy link"), 1300);
}

function downloadResult() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(resultBlob);
  a.download = `${($("#titleInput").value.trim() || "recording").replace(/[\\/:*?"<>|]+/g, " ")}.webm`;
  a.click();
}

// ---------- helpers ----------
function countdown(seconds) {
  return new Promise((resolve) => {
    if (!seconds) return resolve();
    const el = $("#countdown");
    const num = $("#countNum");
    let n = seconds;
    num.textContent = n;
    el.classList.remove("hidden");
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(id); el.classList.add("hidden"); resolve(); }
      else num.textContent = n;
    }, 1000);
  });
}

async function grabThumbnail(blob) {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(blob);
  video.muted = true;
  await new Promise((res) => { video.onloadeddata = () => video.play().then(res).catch(res); video.onerror = res; });
  await new Promise((r) => setTimeout(r, 200));
  const canvas = document.createElement("canvas");
  canvas.width = 160; canvas.height = 90;
  canvas.getContext("2d").drawImage(video, 0, 0, 160, 90);
  video.pause();
  return canvas.toDataURL("image/jpeg", 0.6);
}

function friendlyMediaError(err) {
  const name = err?.name;
  if (name === "NotAllowedError")
    return new Error("Permission denied or the picker was dismissed. Click Start to try again.");
  if (name === "NotFoundError")
    return new Error("No camera or microphone found. Check that a device is connected.");
  return new Error(err?.message || "Could not start capture.");
}

function showSetupError(err) {
  const el = $("#setupError");
  el.textContent = err.message;
  el.classList.remove("hidden");
}
function showReviewError(err) {
  const el = $("#reviewError");
  el.textContent = err.message;
  el.classList.remove("hidden");
}
function hide(el) { if (el) el.classList.add("hidden"); }

init();
