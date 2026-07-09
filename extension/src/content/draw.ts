/**
 * Draw / annotate while recording — a full-viewport canvas in the captured overlay, so
 * pen/arrow/rect/highlighter strokes bake into the video live (Loom's drawing tool).
 * The canvas only swallows pointer events while draw mode is on (toggled from the dock);
 * otherwise the page stays fully interactive while the strokes remain visible.
 */
import { root, el, ICONS } from "./overlay.js";

type Tool = "pen" | "arrow" | "rect" | "highlight";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[]; // pen/highlight: path; arrow/rect: [start, end]
}

const COLORS = ["#38C6DD", "#EF4444", "#FACC15", "#22C55E", "#FFFFFF", "#0A0A0A"];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let bar: HTMLElement | null = null;
let enabled = false;
let tool: Tool = "pen";
let color = "#38C6DD";
const strokes: Stroke[] = [];
let live: Stroke | null = null;

function dpr(): number {
  return window.devicePixelRatio || 1;
}

function resize(): void {
  if (!canvas || !ctx) return;
  const d = dpr();
  canvas.width = Math.floor(window.innerWidth * d);
  canvas.height = Math.floor(window.innerHeight * d);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  redraw();
}

function drawStroke(s: Stroke): void {
  const first = s.points[0];
  if (!ctx || !first) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.globalAlpha = s.tool === "highlight" ? 0.32 : 1;
  ctx.lineWidth = s.tool === "highlight" ? 16 : s.width;

  if (s.tool === "pen" || s.tool === "highlight") {
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (s.points.length >= 2) {
    const a = first;
    const b = s.points[s.points.length - 1]!;
    if (s.tool === "rect") {
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else {
      // arrow
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = 13;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang - Math.PI / 6), b.y - head * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(b.x - head * Math.cos(ang + Math.PI / 6), b.y - head * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function redraw(): void {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const s of strokes) drawStroke(s);
  if (live) drawStroke(live);
}

function mount(): void {
  if (canvas) return;
  canvas = el("canvas", "fc-draw-canvas");
  ctx = canvas.getContext("2d");
  root().appendChild(canvas);
  resize();

  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled) return;
    e.preventDefault();
    canvas!.setPointerCapture(e.pointerId);
    live = { tool, color, width: 4, points: [{ x: e.clientX, y: e.clientY }] };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!enabled || !live) return;
    const pt = { x: e.clientX, y: e.clientY };
    if (live.tool === "pen" || live.tool === "highlight") live.points.push(pt);
    else live.points[1] = pt; // arrow/rect: keep just start + current end
    redraw();
  });
  const finish = () => {
    if (live && live.points.length > 0) strokes.push(live);
    live = null;
    redraw();
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  window.addEventListener("resize", resize);

  bar = buildBar();
  root().appendChild(bar);
}

function buildBar(): HTMLElement {
  const wrap = el("div", "fc-draw-bar");
  const tools: [Tool, string][] = [
    ["pen", ICONS.pen],
    ["arrow", ICONS.arrow],
    ["rect", ICONS.rect],
    ["highlight", ICONS.highlight],
  ];
  const toolBtns: Record<string, HTMLButtonElement> = {};
  for (const [t, icon] of tools) {
    const b = el("button", "fc-btn", icon);
    b.title = t.charAt(0).toUpperCase() + t.slice(1);
    if (t === tool) b.classList.add("active");
    b.addEventListener("click", () => {
      tool = t;
      Object.entries(toolBtns).forEach(([k, node]) => node.classList.toggle("active", k === t));
    });
    toolBtns[t] = b;
    wrap.appendChild(b);
  }

  const swatches = el("div", "fc-draw-swatches");
  for (const c of COLORS) {
    const s = el("button", "fc-swatch");
    s.style.background = c;
    if (c === color) s.classList.add("active");
    s.addEventListener("click", () => {
      color = c;
      swatches.querySelectorAll(".fc-swatch").forEach((n) => n.classList.remove("active"));
      s.classList.add("active");
    });
    swatches.appendChild(s);
  }
  wrap.appendChild(swatches);

  const undo = el("button", "fc-btn", ICONS.undo);
  undo.title = "Undo";
  undo.addEventListener("click", () => {
    strokes.pop();
    redraw();
  });
  const clear = el("button", "fc-btn", ICONS.clear);
  clear.title = "Clear all";
  clear.addEventListener("click", () => clearDraw());
  wrap.append(undo, clear);
  return wrap;
}

export function isDrawing(): boolean {
  return enabled;
}

/** Toggle draw mode. Returns the new enabled state. */
export function toggleDraw(): boolean {
  mount();
  enabled = !enabled;
  canvas?.classList.toggle("on", enabled);
  bar?.classList.toggle("show", enabled);
  return enabled;
}

export function clearDraw(): void {
  strokes.length = 0;
  live = null;
  redraw();
}

/** Full teardown (recording ended): drop strokes and the canvas/bar. */
export function teardownDraw(): void {
  enabled = false;
  strokes.length = 0;
  live = null;
  canvas?.remove();
  bar?.remove();
  window.removeEventListener("resize", resize);
  canvas = null;
  ctx = null;
  bar = null;
}
