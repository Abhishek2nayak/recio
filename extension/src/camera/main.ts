/**
 * Camera bubble page, embedded as a chrome-extension:// iframe by the content
 * script. Because it runs on the EXTENSION origin, the camera permission is granted
 * once for Vyooom and persists across every website — no per-site prompts.
 */
const video = document.getElementById("cam") as HTMLVideoElement;
const deviceId = new URL(location.href).searchParams.get("device") ?? "";

navigator.mediaDevices
  .getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
    audio: false,
  })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch(() => {
    document.body.classList.add("blocked");
  });

// Stop the camera when the iframe is torn down (recording ended / tab hidden).
window.addEventListener("pagehide", () => {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
});
