/**
 * Live page blur — mark sensitive areas BEFORE/DURING recording; the blurred regions
 * live in the captured overlay so they bake into the video (they can't be removed after,
 * exactly like Loom's blur). Two ways to add a region while "armed":
 *   • hover an element → a snap box hugs its bounds → click to blur it (tracks the
 *     element on scroll, so a field stays covered as the page moves)
 *   • drag a free rectangle → a screen-fixed blur region
 * Armed mode also lets you drag regions around and remove them (✕).
 */
import { root, el, HOST_ID, ICONS } from "./overlay.js";

interface Region {
  id: string;
  node: HTMLElement;
  mode: "element" | "region";
  elRef?: Element;
  // viewport rect (region mode) — element mode recomputes from elRef
  x: number;
  y: number;
  w: number;
  h: number;
}

const regions: Region[] = [];
let armEl: HTMLElement | null = null;
let nextId = 0;
// One-shot callback fired when the current arm session ends (Done / Esc). Used by the
// launcher to restore its panel after you finish blurring; null for dock-armed sessions.
let onDisarm: (() => void) | null = null;

export function isBlurArmed(): boolean {
  return armEl != null;
}

export function hasBlurRegions(): boolean {
  return regions.length > 0;
}

/**
 * Toggle the arm overlay. Returns the new armed state. `onDone` (optional) fires once
 * when this arm session ends — the launcher passes it to reopen its panel afterwards.
 */
export function toggleBlur(onDone?: () => void): boolean {
  if (armEl) {
    disarmBlur();
    return false;
  }
  onDisarm = onDone ?? null;
  armBlur();
  return true;
}

export function clearBlur(): void {
  disarmBlur();
  for (const r of regions) r.node.remove();
  regions.length = 0;
}

function place(r: Region): void {
  r.node.style.left = `${r.x}px`;
  r.node.style.top = `${r.y}px`;
  r.node.style.width = `${r.w}px`;
  r.node.style.height = `${r.h}px`;
}

function reflowElementRegions(): void {
  for (const r of regions) {
    if (r.mode !== "element" || !r.elRef) continue;
    if (!r.elRef.isConnected) {
      r.node.style.display = "none";
      continue;
    }
    const b = r.elRef.getBoundingClientRect();
    r.node.style.display = b.width && b.height ? "block" : "none";
    r.x = b.left;
    r.y = b.top;
    r.w = b.width;
    r.h = b.height;
    place(r);
  }
}

function addRegion(mode: "element" | "region", x: number, y: number, w: number, h: number, elRef?: Element): void {
  const node = el("div", "fc-blur-region");
  const xBtn = el("button", "fc-blur-x", ICONS.x);
  node.appendChild(xBtn);
  const r: Region = { id: `b${nextId++}`, node, mode, elRef, x, y, w, h };
  place(r);
  if (armEl) node.classList.add("editing");
  root().appendChild(node);
  regions.push(r);

  xBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    node.remove();
    const i = regions.indexOf(r);
    if (i >= 0) regions.splice(i, 1);
  });

  // Drag to reposition (edit mode only). Element-tracked regions become free once moved.
  node.addEventListener("pointerdown", (e) => {
    if (!armEl || (e.target as HTMLElement).closest(".fc-blur-x")) return;
    e.stopPropagation();
    e.preventDefault();
    r.mode = "region";
    r.elRef = undefined;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = r.x;
    const oy = r.y;
    node.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      r.x = Math.max(0, ox + (ev.clientX - sx));
      r.y = Math.max(0, oy + (ev.clientY - sy));
      place(r);
    };
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
  });
}

function armBlur(): void {
  for (const r of regions) r.node.classList.add("editing");

  const arm = el("div", "fc-arm");
  const snap = el("div", "fc-arm-snap");
  const rect = el("div", "fc-arm-rect");
  const hint = el(
    "div",
    "fc-arm-hint",
    `<span><b>Drag</b> to blur an area &nbsp;·&nbsp; <b>click</b> an element to blur it</span><button class="fc-arm-done">Done</button>`,
  );
  arm.append(snap, rect, hint);
  root().appendChild(arm);
  armEl = arm;

  let start: { x: number; y: number } | null = null;
  let dragged = false;
  let hovered: Element | null = null;

  const pageElementAt = (x: number, y: number): Element | null => {
    arm.style.pointerEvents = "none";
    const els = document.elementsFromPoint(x, y);
    arm.style.pointerEvents = "auto";
    return els.find((e) => (e as HTMLElement).id !== HOST_ID && e !== document.body && e !== document.documentElement) ?? null;
  };

  arm.addEventListener("pointermove", (e) => {
    if (start) {
      dragged = Math.abs(e.clientX - start.x) > 4 || Math.abs(e.clientY - start.y) > 4;
      const x = Math.min(start.x, e.clientX);
      const y = Math.min(start.y, e.clientY);
      rect.style.display = "block";
      rect.style.left = `${x}px`;
      rect.style.top = `${y}px`;
      rect.style.width = `${Math.abs(e.clientX - start.x)}px`;
      rect.style.height = `${Math.abs(e.clientY - start.y)}px`;
      snap.style.display = "none";
      return;
    }
    hovered = pageElementAt(e.clientX, e.clientY);
    if (hovered) {
      const b = hovered.getBoundingClientRect();
      snap.style.display = "block";
      snap.style.left = `${b.left}px`;
      snap.style.top = `${b.top}px`;
      snap.style.width = `${b.width}px`;
      snap.style.height = `${b.height}px`;
    } else {
      snap.style.display = "none";
    }
  });

  arm.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".fc-arm-hint")) return;
    start = { x: e.clientX, y: e.clientY };
    dragged = false;
  });

  arm.addEventListener("pointerup", (e) => {
    if ((e.target as HTMLElement).closest(".fc-arm-hint")) return;
    rect.style.display = "none";
    if (start && dragged) {
      const x = Math.min(start.x, e.clientX);
      const y = Math.min(start.y, e.clientY);
      const w = Math.abs(e.clientX - start.x);
      const h = Math.abs(e.clientY - start.y);
      if (w > 6 && h > 6) addRegion("region", x, y, w, h);
    } else if (start && hovered) {
      const b = hovered.getBoundingClientRect();
      if (b.width > 4 && b.height > 4) addRegion("element", b.left, b.top, b.width, b.height, hovered);
    }
    start = null;
  });

  hint.querySelector(".fc-arm-done")?.addEventListener("click", () => disarmBlur());
  document.addEventListener("keydown", onKey, true);
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape" && armEl) {
    e.preventDefault();
    disarmBlur();
  }
}

export function disarmBlur(): void {
  armEl?.remove();
  armEl = null;
  for (const r of regions) r.node.classList.remove("editing");
  document.removeEventListener("keydown", onKey, true);
  // Fire (and clear) the one-shot end callback — e.g. restore the launcher panel.
  const cb = onDisarm;
  onDisarm = null;
  cb?.();
}

// Keep element-tracked blurs glued to their element as the page scrolls/resizes.
window.addEventListener("scroll", reflowElementRegions, true);
window.addEventListener("resize", reflowElementRegions);
