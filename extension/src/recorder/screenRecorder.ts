/**
 * MediaRecorder wrapper around `getDisplayMedia`. Records the chosen surface
 * (monitor / window / tab) plus, optionally, mixed microphone audio.
 *
 * The webcam is NOT composited here anymore — it's an on-page bubble (content
 * script) that the screen recording captures naturally, so it can follow you across
 * tabs the way Loom does. This keeps the recorder simple and surface-independent.
 *
 * Runs in a real page (the studio tab) — MV3 SWs can't use MediaRecorder. Finalizes
 * exactly once via `settle()`, whether stopped manually or by the native "Stop
 * sharing" / the shared window closing, so the UI never gets stuck.
 */

export interface RecorderOptions {
  microphone?: boolean;
  /** Specific mic device (empty/undefined = system default). */
  micDeviceId?: string;
  /** Capture frame rate hint (the surface size still dominates resolution). */
  frameRate?: number;
  /** MediaRecorder target video bitrate (bits/sec). */
  videoBitsPerSecond?: number;
  /** Whiteboard mode: pre-select the current tab in the picker (one-click capture). */
  preferCurrentTab?: boolean;
  /** Fired when the recording ends on its own (native stop / window closed). */
  onEnded?: (result: RecordingResult) => void;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

export class ScreenRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private displayStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private startedAt = 0;
  private pausedMs = 0;
  private lastPauseAt = 0;
  private mimeType = "video/webm";
  private videoBitsPerSecond = 0;
  private settled = false;
  private result: RecordingResult | null = null;
  private pendingResolve: ((r: RecordingResult) => void) | null = null;
  private onEndedCb: ((r: RecordingResult) => void) | null = null;

  /** Full start = prepare (gesture: shows the screen picker) then begin recording. */
  async start(options: RecorderOptions = {}): Promise<void> {
    await this.prepare(options);
    this.begin();
  }

  /**
   * Acquire the display + audio streams and build the MediaRecorder, but DON'T start
   * recording yet. Must be called on a user gesture (the screen picker needs it).
   * Split from `begin()` so a countdown can run in between without recording it.
   */
  async prepare(options: RecorderOptions = {}): Promise<void> {
    this.settled = false;
    this.result = null;
    this.pendingResolve = null;
    this.onEndedCb = options.onEnded ?? null;

    const videoConstraints: MediaTrackConstraints = {
      // For whiteboard mode we don't bias toward the monitor — the current tab
      // (the Vyooom whiteboard canvas) should be the default pick.
      ...(options.preferCurrentTab ? {} : ({ displaySurface: "monitor" } as MediaTrackConstraints)),
      ...(options.frameRate ? { frameRate: { ideal: options.frameRate } } : {}),
    };
    this.displayStream = await navigator.mediaDevices.getDisplayMedia(
      // `preferCurrentTab` + `displaySurface` aren't in the lib DOM types yet.
      {
        video: videoConstraints,
        audio: true,
        ...(options.preferCurrentTab ? { preferCurrentTab: true } : {}),
      } as DisplayMediaStreamOptions,
    );

    const audioTracks = await this.buildAudioTracks(options.microphone === true, options.micDeviceId);
    const combined = new MediaStream([...this.displayStream.getVideoTracks(), ...audioTracks]);

    this.mimeType = pickMimeType();
    this.videoBitsPerSecond = options.videoBitsPerSecond ?? 0;
    this.recorder = new MediaRecorder(combined, {
      mimeType: this.mimeType,
      ...(options.videoBitsPerSecond ? { videoBitsPerSecond: options.videoBitsPerSecond } : {}),
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => this.settle();

    // Native "Stop sharing" / the shared window closing ends the display track.
    this.displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
      else this.settle();
    });
  }

  /** Start the prepared MediaRecorder (call after `prepare()` + any countdown). */
  begin(): void {
    if (!this.recorder) throw new Error("Call prepare() before begin().");
    this.recorder.start(1000);
    this.startedAt = performance.now();
    this.pausedMs = 0;
  }

  private async buildAudioTracks(withMic: boolean, micDeviceId?: string): Promise<MediaStreamTrack[]> {
    const displayAudio = this.displayStream?.getAudioTracks() ?? [];
    if (!withMic) return displayAudio;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      });
    } catch {
      return displayAudio; // mic denied → system audio only
    }

    this.audioContext = new AudioContext();
    const destination = this.audioContext.createMediaStreamDestination();
    if (displayAudio.length) {
      this.audioContext.createMediaStreamSource(new MediaStream(displayAudio)).connect(destination);
    }
    this.audioContext.createMediaStreamSource(this.micStream).connect(destination);
    return destination.stream.getAudioTracks();
  }

  pause(): void {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
      this.lastPauseAt = performance.now();
    }
  }

  resume(): void {
    if (this.recorder?.state === "paused") {
      this.recorder.resume();
      this.pausedMs += performance.now() - this.lastPauseAt;
    }
  }

  /**
   * Throw away what's recorded so far and start a fresh take on the SAME display
   * stream — no second surface picker (the gesture's already spent). Used by the
   * dock's "Restart" control, mirroring Loom's live re-record.
   */
  restart(): void {
    if (!this.recorder) return;
    // Drop the in-flight take without finalizing it.
    if (this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    // Rebuild a recorder over the still-live combined stream so we keep capturing
    // the same surface (+ mic mix) we already negotiated in prepare().
    const stream = this.recorder.stream;
    this.recorder = new MediaRecorder(stream, {
      mimeType: this.mimeType,
      ...(this.videoBitsPerSecond ? { videoBitsPerSecond: this.videoBitsPerSecond } : {}),
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => this.settle();
    this.settled = false;
    this.result = null;
    this.pendingResolve = null;
    this.recorder.start(1000);
    this.startedAt = performance.now();
    this.pausedMs = 0;
    this.lastPauseAt = 0;
  }

  get state(): "inactive" | "recording" | "paused" {
    return this.recorder?.state ?? "inactive";
  }

  /** The captured display stream — for a muted on-screen preview in the studio. */
  get previewStream(): MediaStream | null {
    return this.displayStream;
  }

  get elapsedMs(): number {
    if (this.settled && this.result) return this.result.durationMs;
    if (!this.startedAt) return 0;
    const now = this.state === "paused" ? this.lastPauseAt : performance.now();
    return Math.max(0, now - this.startedAt - this.pausedMs);
  }

  /**
   * Finalize exactly once, from whichever path got here first (manual stop, native
   * "Stop sharing", or the window closing). Resolves a pending `stop()`, else
   * notifies via `onEnded`.
   */
  private settle(): void {
    if (this.settled) {
      if (this.pendingResolve && this.result) {
        this.pendingResolve(this.result);
        this.pendingResolve = null;
      }
      return;
    }
    this.settled = true;
    const durationMs = performance.now() - this.startedAt - this.pausedMs;
    this.result = {
      blob: new Blob(this.chunks, { type: this.mimeType }),
      mimeType: this.mimeType,
      durationMs,
    };
    this.cleanup();
    if (this.pendingResolve) {
      this.pendingResolve(this.result);
      this.pendingResolve = null;
    } else {
      this.onEndedCb?.(this.result);
    }
  }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      if (this.settled && this.result) {
        resolve(this.result);
        return;
      }
      this.pendingResolve = resolve;
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
      else this.settle();
    });
  }

  /** Abort without producing a file (the "delete/cancel" control). */
  discard(): void {
    this.settled = true;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.displayStream?.getTracks().forEach((t) => t.stop());
    this.micStream?.getTracks().forEach((t) => t.stop());
    void this.audioContext?.close();
    this.displayStream = null;
    this.micStream = null;
    this.audioContext = null;
    this.recorder = null;
  }
}
