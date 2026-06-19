/**
 * Capture a poster frame from a recorded video blob (JPEG, ≤640px wide). Used at
 * publish time so share links unfurl with a real preview image (og:image) and the
 * dashboard cards get a poster. Best-effort: callers treat null as "no thumbnail".
 *
 * Runs wherever publish runs (studio tab / offscreen document) — both have a DOM.
 */
const STEP_TIMEOUT_MS = 5000;

function waitFor(el: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), STEP_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      el.removeEventListener(event, done);
      el.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      clearTimeout(timer);
      reject(new Error("video decode failed"));
    };
    el.addEventListener(event, done, { once: true });
    el.addEventListener("error", fail, { once: true });
  });
}

export async function captureVideoThumbnail(blob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  try {
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    await waitFor(video, "loadeddata");

    // Skip a beat in: frame 0 is often the picker dialog or a blank screen.
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const target = dur > 2 ? Math.min(1.5, dur * 0.1) : 0.1;
    video.currentTime = target;
    await waitFor(video, "seeked").catch(() => {}); // unseekable → use whatever frame we have

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 640 / w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}
