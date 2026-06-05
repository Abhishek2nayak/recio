/**
 * Offscreen recorder — the Loom-style capture engine.
 *
 * MV3 service workers can't run MediaRecorder and `getDisplayMedia` can't run in an
 * offscreen document, so the background SW gets a stream id from
 * `desktopCapture.chooseDesktopMedia` (the native screen/window/tab picker) and hands
 * it here. This document then opens the stream via `getUserMedia({chromeMediaSource})`,
 * mixes the mic, records, and uploads through the shared publish pipeline — all with
 * NO visible page. Controls (pause/resume/stop) and the countdown are relayed by the
 * SW from the on-page floating bar; live state flows back out as RECORDING_TICK so the
 * bar + camera bubble on the user's real tab mirror it.
 */
import { getSettings, QUALITY_PRESETS } from "../lib/storage.js";
import { publishToDefault } from "../storage/publish.js";
import { sendMessage, type Message } from "../lib/messages.js";

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let displayStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let mimeType = "video/webm";
let startedAt = 0;
let pausedMs = 0;
let lastPauseAt = 0;
let settled = false;
let tickTimer: number | null = null;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

function defaultTitle(): string {
  const stamp = new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Recording — ${stamp}`;
}

function elapsedMs(): number {
  if (!startedAt) return 0;
  const now = recorder?.state === "paused" ? lastPauseAt : performance.now();
  return Math.max(0, now - startedAt - pausedMs);
}

/** Open the chosen surface (and optional system audio) from the desktopCapture id. */
async function acquire(streamId: string): Promise<void> {
  const settings = await getSettings();
  const preset = QUALITY_PRESETS[settings.quality];
  // The chromeMediaSource constraints are the legacy `mandatory` shape, absent from
  // the standard DOM types — hence the casts.
  const video = {
    mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId, maxFrameRate: preset.frameRate },
  };
  const audio = { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } };
  try {
    displayStream = await navigator.mediaDevices.getUserMedia({ video, audio } as unknown as MediaStreamConstraints);
  } catch {
    // The user didn't share system audio — capture video only.
    displayStream = await navigator.mediaDevices.getUserMedia({ video } as unknown as MediaStreamConstraints);
  }

  const audioTracks = await buildAudioTracks(settings.microphone, settings.micDeviceId);
  const combined = new MediaStream([...displayStream.getVideoTracks(), ...audioTracks]);

  mimeType = pickMimeType();
  recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: preset.videoBitsPerSecond });
  chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => void finalize();
  // Native "Stop sharing" / closing the shared window ends the display track.
  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else void finalize();
  });
}

/** System audio (if shared) mixed with the mic via an AudioContext. */
async function buildAudioTracks(withMic: boolean, micDeviceId: string): Promise<MediaStreamTrack[]> {
  const displayAudio = displayStream?.getAudioTracks() ?? [];
  if (!withMic) return displayAudio;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
    });
  } catch {
    return displayAudio; // mic denied → system audio only
  }
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  if (displayAudio.length) {
    audioContext.createMediaStreamSource(new MediaStream(displayAudio)).connect(destination);
  }
  audioContext.createMediaStreamSource(micStream).connect(destination);
  return destination.stream.getAudioTracks();
}

function sendTick(state: "recording" | "paused"): void {
  void sendMessage({ type: "RECORDING_TICK", state, elapsedMs: elapsedMs() });
}

async function start(streamId: string): Promise<void> {
  settled = false;
  try {
    await acquire(streamId);
  } catch (err) {
    void sendMessage({ type: "RECORDING_FAILED", error: err instanceof Error ? err.message : "Capture failed." });
    return;
  }

  const settings = await getSettings();
  if (settings.countdown) {
    void sendMessage({ type: "REQUEST_COUNTDOWN", seconds: 3 });
    await delay(3 * 800); // keep in lockstep with the on-page countdown
  }

  recorder!.start(1000);
  startedAt = performance.now();
  pausedMs = 0;
  sendTick("recording");
  tickTimer = window.setInterval(() => sendTick(recorder?.state === "paused" ? "paused" : "recording"), 1000);
}

function pause(): void {
  if (recorder?.state === "recording") {
    recorder.pause();
    lastPauseAt = performance.now();
    sendTick("paused");
  }
}

function resume(): void {
  if (recorder?.state === "paused") {
    recorder.resume();
    pausedMs += performance.now() - lastPauseAt;
    sendTick("recording");
  }
}

function stop(): void {
  if (recorder && recorder.state !== "inactive") recorder.stop(); // → onstop → finalize
  else void finalize();
}

/** Finalize once, upload to the default destination, and report the result. */
async function finalize(): Promise<void> {
  if (settled) return;
  settled = true;
  if (tickTimer != null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  const durationMs = elapsedMs();
  const blob = new Blob(chunks, { type: mimeType });
  cleanup();
  void sendMessage({ type: "RECORDING_ENDED" }); // hide the bar + camera bubble

  try {
    const { mediaId, shareUrl } = await publishToDefault({
      blob,
      title: defaultTitle(),
      type: "recording",
      durationMs,
      recorderMime: mimeType,
    });
    void sendMessage({ type: "RECORDING_PUBLISHED", shareUrl, mediaId });
  } catch (err) {
    void sendMessage({ type: "RECORDING_FAILED", error: err instanceof Error ? err.message : "Upload failed." });
  }
}

function cleanup(): void {
  displayStream?.getTracks().forEach((t) => t.stop());
  micStream?.getTracks().forEach((t) => t.stop());
  void audioContext?.close();
  displayStream = null;
  micStream = null;
  audioContext = null;
  recorder = null;
}

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "OFFSCREEN_START") void start(message.streamId);
  else if (message.type === "OFFSCREEN_CONTROL") {
    if (message.action === "pause") pause();
    if (message.action === "resume") resume();
    if (message.action === "stop") stop();
  }
  // Fire-and-forget: never respond, so we don't race the SW's own listener.
});
