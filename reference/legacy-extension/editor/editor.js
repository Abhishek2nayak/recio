import { getSettings } from "../lib/store.js";
import { publish, formatBytes } from "../lib/publish.js";

const $ = (s) => document.querySelector(s);
const PENDING_KEY = "pending_capture";
const COLORS = ["#f2545b", "#6d5efc", "#36d399", "#fbbf24", "#111827", "#ffffff"];

const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

let baseImage = null; // the original screenshot, redrawn under annotations
let shapes = []; // committed annotations
let tool = "cursor";
let color = COLORS[0];
let drawing = null; // in-progress shape
let capture = null;

async function init() {
  const { [PENDING_KEY]: pending } = await chrome.storage.local.get(PENDING_KEY);
  if (!pending) {
    showError(new Error("No screenshot found. Capture one from the MyLoom popup."));
    return;
  }
  capture = pending;
  await chrome.storage.local.remove(PENDING_KEY); // consume it

  // If an area selection was made, crop the full-tab screenshot down to it.
  baseImage = await loadAndCrop(pending.dataUrl, pending.cropRect);
  canvas.width = baseImage.naturalWidth;
  canvas.height = baseImage.naturalHeight;
  redraw();

  $("#titleInput").value = pending.sourceTitle
    ? `Screenshot — ${pending.sourceTitle}`.slice(0, 80)
    : "Screenshot";
  $("#stats").textContent = `${canvas.width}×${canvas.height}px`;

  buildPalette();
  wire();
}

function buildPalette() {
  const wrap = $("#colors");
  COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "swatch" + (i === 0 ? " active" : "");
    b.style.background = c;
    b.addEventListener("click", () => {
      color = c;
      document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
      b.classList.add("active");
    });
    wrap.appendChild(b);
  });
}

function wire() {
  document.querySelectorAll(".tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      tool = btn.dataset.tool;
      document.querySelectorAll(".tool").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      canvas.style.cursor = tool === "cursor" ? "default" : "crosshair";
    });
  });
  $("#undoBtn").addEventListener("click", () => {
    shapes.pop();
    redraw();
  });
  $("#saveBtn").addEventListener("click", () => saveToCloud().catch(showError));
  $("#downloadBtn").addEventListener("click", download);
  $("#copyLinkBtn").addEventListener("click", copyLink);

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// ---------- drawing ----------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function onDown(e) {
  if (tool === "cursor") return;
  const p = canvasPoint(e);
  drawing = { tool, color, points: [p], start: p, end: p };
  canvas.setPointerCapture(e.pointerId);
}
function onMove(e) {
  if (!drawing) return;
  const p = canvasPoint(e);
  if (drawing.tool === "pen") drawing.points.push(p);
  else drawing.end = p;
  redraw();
  drawShape(drawing);
}
function onUp() {
  if (!drawing) return;
  shapes.push(drawing);
  drawing = null;
  redraw();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (baseImage) ctx.drawImage(baseImage, 0, 0);
  for (const s of shapes) drawShape(s);
}

function drawShape(s) {
  const lw = Math.max(3, canvas.width * 0.004);
  ctx.lineWidth = lw;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (s.tool === "pen") {
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  } else if (s.tool === "rect") {
    ctx.strokeRect(s.start.x, s.start.y, s.end.x - s.start.x, s.end.y - s.start.y);
  } else if (s.tool === "arrow") {
    drawArrow(s.start, s.end, lw);
  }
}

function drawArrow(a, b, lw) {
  const head = Math.max(12, lw * 3.5);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

// ---------- export + publish ----------
function toBlob() {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function saveToCloud() {
  hide($("#error"));
  const blob = await toBlob();
  $("#saveBtn").disabled = true;
  $("#downloadBtn").disabled = true;
  $("#progressWrap").classList.remove("hidden");
  setProgress(0, "Preparing upload…");

  try {
    const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
    const item = await publish({
      blob,
      title: $("#titleInput").value.trim() || "Screenshot",
      type: "image",
      thumbnail,
      onProgress: (p) => setProgress(p, `Uploading… ${Math.round(p * 100)}%`),
    });
    setProgress(1, "Done");
    $("#stats").textContent = `${canvas.width}×${canvas.height}px · ${formatBytes(blob.size)}`;
    await showShare(item.viewUrl);
  } catch (err) {
    $("#progressWrap").classList.add("hidden");
    showError(err);
  } finally {
    $("#saveBtn").disabled = false;
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

async function download() {
  const blob = await toBlob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${($("#titleInput").value.trim() || "screenshot").replace(/[\\/:*?"<>|]+/g, " ")}.png`;
  a.click();
}

// If a cropRect is present (from area screenshot), bake the crop into a new
// Image so redraw() always just drawImage(baseImage, 0, 0).
async function loadAndCrop(src, cropRect) {
  const img = await loadImage(src);
  if (!cropRect) return img;
  const { x, y, width, height } = cropRect;
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  offscreen.getContext("2d").drawImage(img, -x, -y);
  return loadImage(offscreen.toDataURL("image/png"));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function showError(err) {
  const el = $("#error");
  el.textContent = err.message;
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

init();
