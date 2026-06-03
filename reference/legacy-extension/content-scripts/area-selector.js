// Injected when the user clicks "Select area" for a screenshot.
// Renders a crosshair overlay; on mouse-up, reports the selection rect
// back to the service worker, which captures + opens the editor.

(function () {
  // Prevent double-injection.
  if (document.getElementById("ml-selector-root")) return;

  const dpr = window.devicePixelRatio || 1;
  let sx = 0, sy = 0, dragging = false;

  // ── Overlay ────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.id = "ml-selector-root";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: "crosshair",
    userSelect: "none",
    background: "rgba(0,0,0,0.42)",
  });

  // ── Selection rectangle ────────────────────────────────────────────
  const sel = document.createElement("div");
  Object.assign(sel.style, {
    position: "fixed",
    border: "2px solid #7c6ef2",
    background: "rgba(124,110,242,0.08)",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.42)",
    display: "none",
    pointerEvents: "none",
  });
  root.appendChild(sel);

  // ── Size badge ─────────────────────────────────────────────────────
  const badge = document.createElement("div");
  Object.assign(badge.style, {
    position: "fixed",
    padding: "3px 8px",
    background: "#7c6ef2",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "600",
    fontFamily: "ui-sans-serif,system-ui,sans-serif",
    borderRadius: "5px",
    pointerEvents: "none",
    display: "none",
    lineHeight: "1.4",
    whiteSpace: "nowrap",
  });
  root.appendChild(badge);

  // ── Hint ───────────────────────────────────────────────────────────
  const hint = document.createElement("div");
  Object.assign(hint.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(22,23,31,0.92)",
    color: "#e2e4f2",
    padding: "12px 22px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    fontFamily: "ui-sans-serif,system-ui,sans-serif",
    textAlign: "center",
    lineHeight: "1.5",
    pointerEvents: "none",
    userSelect: "none",
    backdropFilter: "blur(8px)",
  });
  hint.innerHTML = "Drag to select area<br><span style='font-size:12px;opacity:.6'>Esc to cancel</span>";
  root.appendChild(hint);

  // ── Geometry helpers ───────────────────────────────────────────────
  function update(ex, ey) {
    const x = Math.min(ex, sx);
    const y = Math.min(ey, sy);
    const w = Math.abs(ex - sx);
    const h = Math.abs(ey - sy);
    if (w < 2 || h < 2) { sel.style.display = "none"; badge.style.display = "none"; return; }

    Object.assign(sel.style, {
      left: x + "px", top: y + "px",
      width: w + "px", height: h + "px",
      display: "block",
    });

    // Size badge — keep it just above the selection, nudge if too close to top.
    const bTop = y > 28 ? y - 24 : y + h + 6;
    Object.assign(badge.style, {
      left: x + "px",
      top: bTop + "px",
      display: "block",
    });
    badge.textContent = `${Math.round(w * dpr)} × ${Math.round(h * dpr)}`;
  }

  // ── Event handlers ─────────────────────────────────────────────────
  root.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    hint.style.display = "none";
    sel.style.display = "none";
  });

  root.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    update(e.clientX, e.clientY);
  });

  root.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    dragging = false;

    const x = Math.min(e.clientX, sx);
    const y = Math.min(e.clientY, sy);
    const w = Math.abs(e.clientX - sx);
    const h = Math.abs(e.clientY - sy);

    if (w < 8 || h < 8) {
      // Too small — treat as a cancel.
      cleanup();
      return;
    }

    // Coordinates in CSS pixels + physical pixels (for captureVisibleTab which
    // returns pixels at DPR scale).
    chrome.runtime.sendMessage({
      type: "AREA_SELECTED",
      rect: {
        cssX: Math.round(x),
        cssY: Math.round(y),
        cssW: Math.round(w),
        cssH: Math.round(h),
        x: Math.round(x * dpr),
        y: Math.round(y * dpr),
        width:  Math.round(w * dpr),
        height: Math.round(h * dpr),
      },
    });

    cleanup();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cleanup();
  }, { capture: true, once: true });

  function cleanup() {
    root.remove();
  }

  document.body.appendChild(root);
})();
