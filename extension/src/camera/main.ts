/**
 * Camera bubble page, embedded as a chrome-extension:// iframe by the content script.
 * Because it runs on the EXTENSION origin, the camera permission is granted once for
 * Vyooom and persists across every website — no per-site prompts.
 *
 * The webcam feeds a hidden <video>; a <canvas> renders the (optionally) effect-composited
 * output, so background blur / virtual backgrounds / filters bake into the recording.
 */
import { getSettings, type Settings } from "../lib/storage.js";
import { CameraCompositor, type EffectConfig } from "./effects.js";

const video = document.getElementById("cam") as HTMLVideoElement;
const canvas = document.getElementById("out") as HTMLCanvasElement;
const deviceId = new URL(location.href).searchParams.get("device") ?? "";

const compositor = new CameraCompositor(video, canvas);

function cfgFrom(s: Settings): EffectConfig {
  return { effect: s.cameraEffect, filter: s.cameraFilter, bgColor: s.cameraBgColor, bgImage: s.cameraBgImage };
}

function applyFrame(frame: Settings["cameraFrame"]): void {
  canvas.classList.toggle("ring", frame === "ring");
}

navigator.mediaDevices
  .getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
    audio: false,
  })
  .then((stream) => {
    video.srcObject = stream;
    video.onloadeddata = () => compositor.start();
  })
  .catch(() => {
    document.body.classList.add("blocked");
  });

// Initial effect + live updates when the user changes settings in the studio.
void getSettings().then((s) => {
  compositor.setEffect(cfgFrom(s));
  applyFrame(s.cameraFrame);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings) return;
  const s = changes.settings.newValue as Settings | undefined;
  if (!s) return;
  compositor.setEffect(cfgFrom(s));
  applyFrame(s.cameraFrame);
});

// Stop the camera when the iframe is torn down (recording ended / tab hidden).
window.addEventListener("pagehide", () => {
  compositor.stop();
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
});
