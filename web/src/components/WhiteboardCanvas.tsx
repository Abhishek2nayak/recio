/**
 * Dependency-free whiteboard canvas — the in-house replacement for Excalidraw.
 *
 * A Loom-style drawing surface: pen, line, arrow, rectangle, ellipse, text, and a
 * (vector) eraser, with a color palette, three stroke widths, and undo/redo/clear.
 * The shape model is kept in CSS-pixel coordinates so it survives resizes; two
 * stacked canvases keep it fast — finished shapes are rasterized once onto the
 * "committed" canvas, and only the in-progress shape repaints on the "live" canvas.
 *
 * It fills its parent (position:absolute inset:0), so the host just needs a
 * positioned, sized container. The screen recorder captures whatever is on screen,
 * so nothing here needs to feed the recording — it just has to look right.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Tool = "pen" | "line" | "arrow" | "rect" | "ellipse" | "text" | "eraser";

interface Pt {
  x: number;
  y: number;
}
interface Base {
  id: string;
  color: string;
  width: number;
}
type Shape =
  | (Base & { type: "pen"; points: Pt[] })
  | (Base & { type: "line" | "arrow"; a: Pt; b: Pt })
  | (Base & { type: "rect" | "ellipse"; a: Pt; b: Pt })
  | (Base & { type: "text"; at: Pt; text: string; size: number });

const COLORS = ["#0A0A0A", "#2563EB", "#EF4444", "#F59E0B", "#22C55E", "#FFFFFF"];
const WIDTHS = [3, 6, 12];
const uid = () => Math.random().toString(36).slice(2, 9);

// ── drawing ──────────────────────────────────────────────────────────────────

function stroke(ctx: CanvasRenderingContext2D, s: Shape): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;

  switch (s.type) {
    case "pen": {
      if (s.points.length < 2) {
        const p = s.points[0];
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, s.width / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
      // Quadratic smoothing through midpoints for a natural pen feel.
      for (let i = 1; i < s.points.length - 1; i++) {
        const p = s.points[i]!;
        const n = s.points[i + 1]!;
        ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
      }
      const last = s.points[s.points.length - 1]!;
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      return;
    }
    case "line":
    case "arrow": {
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
      if (s.type === "arrow") arrowhead(ctx, s.a, s.b, s.width);
      return;
    }
    case "rect": {
      const x = Math.min(s.a.x, s.b.x);
      const y = Math.min(s.a.y, s.b.y);
      const w = Math.abs(s.b.x - s.a.x);
      const h = Math.abs(s.b.y - s.a.y);
      const r = Math.min(8, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.stroke();
      return;
    }
    case "ellipse": {
      const cx = (s.a.x + s.b.x) / 2;
      const cy = (s.a.y + s.b.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(s.b.x - s.a.x) / 2, Math.abs(s.b.y - s.a.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case "text": {
      const px = 13 + s.size * 4;
      ctx.font = `600 ${px}px -apple-system, "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "top";
      for (const [i, line] of s.text.split("\n").entries()) ctx.fillText(line, s.at.x, s.at.y + i * px * 1.25);
      return;
    }
  }
}

function arrowhead(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, width: number): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = 8 + width * 1.6;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - len * Math.cos(ang - Math.PI / 6), b.y - len * Math.sin(ang - Math.PI / 6));
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - len * Math.cos(ang + Math.PI / 6), b.y - len * Math.sin(ang + Math.PI / 6));
  ctx.stroke();
}

// ── eraser hit-testing (vector delete) ────────────────────────────────────────

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hits(s: Shape, p: Pt, tol: number): boolean {
  const t = tol + s.width / 2;
  switch (s.type) {
    case "pen":
      return s.points.some((pt, i) => i > 0 && distToSeg(p, s.points[i - 1]!, pt) <= t);
    case "line":
    case "arrow":
      return distToSeg(p, s.a, s.b) <= t;
    case "rect":
    case "ellipse": {
      const x0 = Math.min(s.a.x, s.b.x) - t;
      const y0 = Math.min(s.a.y, s.b.y) - t;
      const x1 = Math.max(s.a.x, s.b.x) + t;
      const y1 = Math.max(s.a.y, s.b.y) + t;
      return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    }
    case "text": {
      const px = 13 + s.size * 4;
      const w = Math.max(...s.text.split("\n").map((l) => l.length)) * px * 0.55;
      const h = s.text.split("\n").length * px * 1.25;
      return p.x >= s.at.x - t && p.x <= s.at.x + w + t && p.y >= s.at.y - t && p.y <= s.at.y + h + t;
    }
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export function WhiteboardCanvas({ theme = "light" }: { theme?: "light" | "dark" }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const commitRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const shapesRef = useRef<Shape[]>([]);
  const undoneRef = useRef<Shape[]>([]);
  const draftRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[1]!);
  const [width, setWidth] = useState(WIDTHS[1]!);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [text, setText] = useState<{ at: Pt; value: string } | null>(null);

  // Live values for the pointer handlers (which are bound once).
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  toolRef.current = tool;
  colorRef.current = color;
  widthRef.current = width;

  const paper = theme === "dark" ? "#0f1115" : "#ffffff";

  const ctxOf = (c: HTMLCanvasElement | null) => c?.getContext("2d") ?? null;

  const renderCommitted = useCallback(() => {
    const c = commitRef.current;
    const ctx = ctxOf(c);
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of shapesRef.current) stroke(ctx, s);
  }, []);

  const sync = () => {
    setCanUndo(shapesRef.current.length > 0);
    setCanRedo(undoneRef.current.length > 0);
  };

  const sizeCanvases = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const { width: w, height: h } = wrap.getBoundingClientRect();
    for (const c of [commitRef.current, liveRef.current]) {
      if (!c) continue;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    renderCommitted();
  }, [renderCommitted]);

  useEffect(() => {
    sizeCanvases();
    const ro = new ResizeObserver(sizeCanvases);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [sizeCanvases]);

  // Re-render committed art when the theme changes (text/white strokes need contrast).
  useEffect(renderCommitted, [renderCommitted, theme]);

  const commit = (s: Shape) => {
    shapesRef.current.push(s);
    undoneRef.current = [];
    const ctx = ctxOf(commitRef.current);
    if (ctx) stroke(ctx, s);
    sync();
  };

  const undo = useCallback(() => {
    const s = shapesRef.current.pop();
    if (!s) return;
    undoneRef.current.push(s);
    renderCommitted();
    sync();
  }, [renderCommitted]);

  const redo = useCallback(() => {
    const s = undoneRef.current.pop();
    if (!s) return;
    shapesRef.current.push(s);
    const ctx = ctxOf(commitRef.current);
    if (ctx) stroke(ctx, s);
    sync();
  }, []);

  const clear = () => {
    if (!shapesRef.current.length) return;
    if (!window.confirm("Clear the whole board?")) return;
    shapesRef.current = [];
    undoneRef.current = [];
    renderCommitted();
    sync();
  };

  // Keyboard shortcuts (ignored while typing into the text box or a form field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (text) return;
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      const map: Record<string, Tool> = { p: "pen", l: "line", a: "arrow", r: "rect", o: "ellipse", t: "text", e: "eraser" };
      const next = map[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, text]);

  // ── pointer handling (bound once; reads live tool/color/width via refs) ──
  const ptOf = (e: PointerEvent): Pt => {
    const r = liveRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drawLive = () => {
    const ctx = ctxOf(liveRef.current);
    const c = liveRef.current;
    if (!ctx || !c) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    if (draftRef.current) stroke(ctx, draftRef.current);
  };

  useEffect(() => {
    const c = liveRef.current;
    if (!c) return;

    const down = (e: PointerEvent) => {
      const t = toolRef.current;
      const p = ptOf(e);

      if (t === "text") {
        setText({ at: p, value: "" });
        return;
      }
      c.setPointerCapture(e.pointerId);
      drawingRef.current = true;

      if (t === "eraser") {
        erase(p);
        return;
      }
      const base = { id: uid(), color: colorRef.current, width: widthRef.current };
      draftRef.current =
        t === "pen"
          ? { ...base, type: "pen", points: [p] }
          : t === "line" || t === "arrow"
            ? { ...base, type: t, a: p, b: p }
            : { ...base, type: t, a: p, b: p };
      drawLive();
    };

    const move = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      const p = ptOf(e);
      if (toolRef.current === "eraser") {
        erase(p);
        return;
      }
      const d = draftRef.current;
      if (!d) return;
      if (d.type === "pen") d.points.push(p);
      else if (d.type !== "text") d.b = p; // text never enters draft; guard narrows the union
      drawLive();
    };

    const up = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const d = draftRef.current;
      draftRef.current = null;
      const ctx = ctxOf(liveRef.current);
      const lc = liveRef.current;
      if (ctx && lc) ctx.clearRect(0, 0, lc.width, lc.height);
      if (!d) return;
      // Drop degenerate click-shapes (a rect/line with no drag).
      if (d.type === "line" || d.type === "arrow" || d.type === "rect" || d.type === "ellipse") {
        if (Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) < 3) return;
      }
      commit(d);
    };

    const erase = (p: Pt) => {
      const list = shapesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        if (hits(list[i]!, p, 6)) {
          list.splice(i, 1);
          renderCommitted();
          sync();
          break;
        }
      }
    };

    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }, [renderCommitted]);

  const commitText = () => {
    if (!text) return;
    const v = text.value.trim();
    if (v) commit({ id: uid(), type: "text", at: text.at, text: v, color: colorRef.current, width: widthRef.current, size: WIDTHS.indexOf(widthRef.current) });
    setText(null);
  };

  const cursor = tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair";

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: paper }}>
      <canvas ref={commitRef} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={liveRef} style={{ position: "absolute", inset: 0, cursor, touchAction: "none" }} />

      {text && (
        <textarea
          autoFocus
          value={text.value}
          onChange={(e) => setText({ ...text, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === "Escape") setText(null);
          }}
          style={{
            position: "absolute",
            left: text.at.x,
            top: text.at.y,
            minWidth: 120,
            font: `600 ${13 + WIDTHS.indexOf(width) * 4}px -apple-system, "Segoe UI", system-ui, sans-serif`,
            color,
            background: "transparent",
            border: `1px dashed ${theme === "dark" ? "#ffffff55" : "#00000055"}`,
            borderRadius: 4,
            padding: 2,
            outline: "none",
            resize: "none",
            overflow: "hidden",
            lineHeight: 1.25,
          }}
        />
      )}

      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
      />
    </div>
  );
}

// ── toolbar ───────────────────────────────────────────────────────────────────

const ICONS: Record<Tool | "undo" | "redo" | "clear", string> = {
  pen: `<path d="M15.5 4.5l4 4M4 20l1.2-4.2L16 5a2 2 0 0 1 3 3L8.2 18.8 4 20Z"/>`,
  line: `<path d="M5 19L19 5"/>`,
  arrow: `<path d="M5 19L19 5M19 5h-6M19 5v6"/>`,
  rect: `<rect x="4" y="6" width="16" height="12" rx="2"/>`,
  ellipse: `<ellipse cx="12" cy="12" rx="8" ry="6"/>`,
  text: `<path d="M5 6h14M12 6v13M9 19h6"/>`,
  eraser: `<path d="M4 16l6-6 8 8H8l-4-2ZM10 10l6-6 4 4-6 6"/>`,
  undo: `<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>`,
  redo: `<path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h3"/>`,
  clear: `<path d="M6 7h12M9 7V5h6v2M8 7l1 13h6l1-13"/>`,
};

function Icon({ path, size = 19 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

const TOOLS: { id: Tool; title: string }[] = [
  { id: "pen", title: "Pen (P)" },
  { id: "line", title: "Line (L)" },
  { id: "arrow", title: "Arrow (A)" },
  { id: "rect", title: "Rectangle (R)" },
  { id: "ellipse", title: "Ellipse (O)" },
  { id: "text", title: "Text (T)" },
  { id: "eraser", title: "Eraser (E)" },
];

function Toolbar(props: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}) {
  const sep = <span style={{ width: 1, height: 26, background: "var(--line)", margin: "0 4px" }} />;
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 6,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        borderRadius: "var(--r-pill)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--e3)",
        maxWidth: "calc(100vw - 32px)",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {TOOLS.map((t) => (
        <TBtn key={t.id} title={t.title} active={props.tool === t.id} onClick={() => props.setTool(t.id)}>
          <Icon path={ICONS[t.id]} />
        </TBtn>
      ))}

      {sep}

      {COLORS.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => props.setColor(c)}
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: c,
            cursor: "pointer",
            border: props.color === c ? "2px solid var(--accent)" : "1px solid var(--line-2)",
            outline: c === "#FFFFFF" ? "1px solid var(--line-2)" : "none",
            outlineOffset: -3,
          }}
        />
      ))}

      {sep}

      {WIDTHS.map((w) => (
        <TBtn key={w} title={`Stroke ${w}px`} active={props.width === w} onClick={() => props.setWidth(w)}>
          <span style={{ width: w + 4, height: w + 4, borderRadius: 999, background: "currentColor", display: "block" }} />
        </TBtn>
      ))}

      {sep}

      <TBtn title="Undo (⌘Z)" disabled={!props.canUndo} onClick={props.onUndo}>
        <Icon path={ICONS.undo} />
      </TBtn>
      <TBtn title="Redo (⇧⌘Z)" disabled={!props.canRedo} onClick={props.onRedo}>
        <Icon path={ICONS.redo} />
      </TBtn>
      <TBtn title="Clear board" onClick={props.onClear}>
        <Icon path={ICONS.clear} />
      </TBtn>
    </div>
  );
}

function TBtn({
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: "var(--r-sm)",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent-ink)" : "var(--ink-3)",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
