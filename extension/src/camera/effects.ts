/**
 * Camera-bubble effects compositor. Renders the webcam to a <canvas> with optional
 * background replacement (blur / virtual background / solid color) via MediaPipe selfie
 * segmentation, plus a cheap color-grade filter. The model + wasm are self-hosted under
 * /mediapipe (MV3 CSP blocks CDN). Everything degrades gracefully: if the segmenter
 * can't load, we fall back to the raw frame with just the filter applied.
 *
 * Shared by the on-page camera iframe (camera/main.ts) and the studio pre-record
 * preview (CameraPreview in Studio.tsx).
 */
import type { ImageSegmenter as ImageSegmenterT } from "@mediapipe/tasks-vision";
import type { CameraEffect, CameraFilter } from "../lib/storage.js";

export interface EffectConfig {
  effect: CameraEffect;
  filter: CameraFilter;
  bgColor: string;
  bgImage: string;
}

/** CSS/canvas filter strings per grade. */
export const FILTERS: Record<CameraFilter, string> = {
  none: "none",
  touchup: "brightness(1.06) saturate(1.05) blur(0.4px)",
  mono: "grayscale(1) contrast(1.06)",
  warm: "sepia(0.32) saturate(1.22) brightness(1.03)",
  cool: "saturate(1.12) hue-rotate(-12deg) brightness(1.02)",
  vivid: "saturate(1.5) contrast(1.12)",
};

/** Virtual-background presets, drawn as gradients so we ship no image assets. */
export const BG_PRESETS: Record<string, [string, string, string]> = {
  aurora: ["#0B1220", "#1E3A8A", "#38C6DD"],
  studio: ["#111113", "#28283A", "#52525F"],
  sunset: ["#3B0764", "#9D174D", "#F59E0B"],
  forest: ["#052E16", "#166534", "#65A30D"],
};

const needsSegmentation = (e: CameraEffect) => e === "blur" || e === "image" || e === "color";

export class CameraCompositor {
  private segmenter: ImageSegmenterT | null = null;
  private loading = false;
  private failed = false;
  private running = false;
  private raf = 0;
  private cfg: EffectConfig = { effect: "none", filter: "none", bgColor: "#0B1220", bgImage: "aurora" };
  private person = document.createElement("canvas");
  private mask = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null;
  private personCtx: CanvasRenderingContext2D | null;
  private maskCtx: CanvasRenderingContext2D | null;

  constructor(
    private video: HTMLVideoElement,
    private canvas: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext("2d");
    this.personCtx = this.person.getContext("2d", { willReadFrequently: false });
    this.maskCtx = this.mask.getContext("2d", { willReadFrequently: true });
  }

  setEffect(cfg: EffectConfig): void {
    this.cfg = cfg;
    if (needsSegmentation(cfg.effect)) void this.ensureSegmenter();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private async ensureSegmenter(): Promise<void> {
    if (this.segmenter || this.loading || this.failed) return;
    this.loading = true;
    try {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(chrome.runtime.getURL("mediapipe"));
      this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: chrome.runtime.getURL("mediapipe/selfie_segmenter.tflite") },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    } catch {
      // Effects unavailable (model/wasm missing) — fall back to filter-only.
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private sizeTo(w: number, h: number): void {
    if (this.canvas.width !== w) {
      this.canvas.width = w;
      this.person.width = w;
    }
    if (this.canvas.height !== h) {
      this.canvas.height = h;
      this.person.height = h;
    }
  }

  private paintBackground(w: number, h: number): void {
    if (!this.ctx) return;
    if (this.cfg.effect === "blur") {
      this.ctx.filter = "blur(12px)";
      this.ctx.drawImage(this.video, 0, 0, w, h);
      this.ctx.filter = "none";
    } else if (this.cfg.effect === "color") {
      this.ctx.fillStyle = this.cfg.bgColor || "#0B1220";
      this.ctx.fillRect(0, 0, w, h);
    } else {
      const stops = BG_PRESETS[this.cfg.bgImage] ?? BG_PRESETS.aurora!;
      const g = this.ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, stops[0]);
      g.addColorStop(0.55, stops[1]);
      g.addColorStop(1, stops[2]);
      this.ctx.fillStyle = g;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private draw(): void {
    const v = this.video;
    if (!this.ctx || v.readyState < 2 || !v.videoWidth) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    this.sizeTo(w, h);
    const filter = FILTERS[this.cfg.filter] ?? "none";

    // Plain pass-through (no background replacement): just the frame + filter.
    if (!needsSegmentation(this.cfg.effect) || this.failed || !this.segmenter) {
      this.ctx.filter = filter;
      this.ctx.drawImage(v, 0, 0, w, h);
      this.ctx.filter = "none";
      return;
    }

    try {
      this.segmenter.segmentForVideo(v, performance.now(), (result) => {
        const mask = result.categoryMask;
        if (!mask || !this.personCtx || !this.maskCtx || !this.ctx) {
          mask?.close();
          this.ctx?.drawImage(v, 0, 0, w, h);
          return;
        }
        const mw = mask.width;
        const mh = mask.height;
        const data = mask.getAsUint8Array();
        // Build an alpha mask (person → opaque) at the model's native resolution.
        this.mask.width = mw;
        this.mask.height = mh;
        const img = this.maskCtx.createImageData(mw, mh);
        for (let i = 0; i < data.length; i++) {
          const person = (data[i] ?? 0) > 0 ? 255 : 0;
          const o = i * 4;
          img.data[o] = 255;
          img.data[o + 1] = 255;
          img.data[o + 2] = 255;
          img.data[o + 3] = person;
        }
        this.maskCtx.putImageData(img, 0, 0);
        mask.close();

        // Person layer = filtered frame clipped to the mask.
        this.personCtx.clearRect(0, 0, w, h);
        this.personCtx.filter = filter;
        this.personCtx.drawImage(v, 0, 0, w, h);
        this.personCtx.filter = "none";
        this.personCtx.globalCompositeOperation = "destination-in";
        this.personCtx.imageSmoothingEnabled = true;
        this.personCtx.drawImage(this.mask, 0, 0, w, h);
        this.personCtx.globalCompositeOperation = "source-over";

        // Composite: background then person.
        this.paintBackground(w, h);
        this.ctx.drawImage(this.person, 0, 0);
      });
    } catch {
      this.failed = true;
      this.ctx.drawImage(v, 0, 0, w, h);
    }
  }
}

/** A small visual frame/ring spec for the bubble (applied as CSS by the consumer). */
export function frameBorder(frame: string): string {
  if (frame === "ring") return "3px solid #38C6DD";
  if (frame === "soft") return "3px solid rgba(255,255,255,.9)";
  return "3px solid rgba(255,255,255,.9)";
}
