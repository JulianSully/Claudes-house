import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  VIEWBOX_WIDTH,
  viewBoxHeight,
  arraySize,
  keepOnCanvas,
  pointerToViewBox,
  toLocal,
  toWorld,
  resizeFromCorner,
  angleTo,
  normaliseAngle,
  fitPanels,
  makeArray,
  PANEL_GAP,
  DEFAULT_PANEL_WIDTH,
} from "./layout";

/**
 * The work surface.
 *
 * Direct manipulation throughout — the earlier version put every action in a
 * side panel, which meant looking away from the roof to change anything. Here:
 *
 *   drag on empty canvas ....... draw a new array, filled with whole panels
 *   drag an array .............. move it
 *   drag the corner handle ..... add or remove panels
 *   drag the top handle ........ rotate (hold Shift to snap to 15°)
 *   wheel ...................... zoom about the cursor
 *   middle-drag or space-drag .. pan
 *   arrows ..................... nudge, Shift for a bigger step
 *   Delete / Backspace ......... remove
 *   Escape ..................... deselect
 *
 * The image lives INSIDE the svg, so zoom and pan are one viewBox change
 * rather than two coordinate systems kept in step.
 */
export default function DesignCanvas({
  imageSrc,
  aspect,
  arrays,
  notes,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelRatio,
  orientation = "landscape",
  selectedId,
  onSelect,
  onChange, // (id, patch)
  onCreate, // (array)
  onDelete,
  readOnly = false,
}) {
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [, forceRender] = useState(0);
  const [draft, setDraft] = useState(null); // rectangle being dragged out
  const [spaceHeld, setSpaceHeld] = useState(false);

  // One object describing how a panel is drawn, passed to every geometry call.
  const spec = useMemo(
    () => ({ panelWidth, ratio: panelRatio, orientation }),
    [panelWidth, panelRatio, orientation]
  );

  const worldHeight = viewBoxHeight(aspect);
  const fullView = useMemo(
    () => ({ x: 0, y: 0, w: VIEWBOX_WIDTH, h: worldHeight }),
    [worldHeight]
  );
  const [view, setView] = useState(fullView);
  useEffect(() => setView(fullView), [fullView]);

  const selected = arrays.find((a) => a.id === selectedId) ?? null;
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  /* ---------------- gestures ---------------- */

  useEffect(() => {
    if (readOnly) return undefined;

    const move = (e) => {
      const g = gesture.current;
      if (!g) return;
      const p = pointerToViewBox(svgRef.current, e);

      if (g.type === "pan") {
        // The pointer should stay glued to the same spot on the photo, so the
        // view moves by the delta in world units, not screen pixels.
        setView((v) => ({ ...v, x: g.startView.x - (p.x - g.start.x), y: g.startView.y - (p.y - g.start.y) }));
        return;
      }
      if (g.type === "draw") {
        setDraft({ x0: g.start.x, y0: g.start.y, x1: p.x, y1: p.y });
        return;
      }
      if (g.type === "move") {
        onChange(g.id, { x: p.x - g.dx, y: p.y - g.dy });
        return;
      }
      if (g.type === "resize") {
        const local = toLocal(g.item, spec, p.x, p.y);
        onChange(g.id, resizeFromCorner(g.item, spec, local.x, local.y));
        return;
      }
      if (g.type === "rotate") {
        const raw = angleTo(g.item, spec, p.x, p.y);
        const snapped = e.shiftKey ? Math.round(raw / 15) * 15 : Math.round(raw);
        onChange(g.id, { rotation: normaliseAngle(snapped) });
      }
    };

    const up = (e) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;

      if (g.type === "draw") {
        const p = pointerToViewBox(svgRef.current, e);
        const w = Math.abs(p.x - g.start.x);
        const h = Math.abs(p.y - g.start.y);
        setDraft(null);
        // A tiny drag is a click: deselect rather than litter the roof with a
        // one-panel array nobody meant to place.
        if (w < 6 && h < 6) {
          onSelect(null);
          return;
        }
        const { cols, rows } = fitPanels(w, h, spec);
        const created = makeArray({
          x: Math.min(g.start.x, p.x),
          y: Math.min(g.start.y, p.y),
          cols,
          rows,
          orientation: spec.orientation,
        });
        onCreate(created);
        return;
      }
      if (g.type === "pan" && g.movedLittle && g.deselectOnTap) onSelect(null);
      forceRender((n) => n + 1);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [onChange, onCreate, onSelect, spec, readOnly]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    if (readOnly) return undefined;
    const down = (e) => {
      if (e.code === "Space") setSpaceHeld(true);
      // Never steal a keystroke meant for a text field.
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        onSelect(null);
        return;
      }
      if (!selectedId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete(selectedId);
        return;
      }
      const step = e.shiftKey ? 10 : 2;
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (nudge) {
        e.preventDefault();
        const item = selected ?? selectedNote;
        if (item) onChange(selectedId, { x: item.x + nudge[0], y: item.y + nudge[1] });
      }
    };
    const up = (e) => e.code === "Space" && setSpaceHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onChange, onDelete, onSelect, readOnly, selected, selectedId, selectedNote]);

  /* ---------------- zoom ---------------- */

  const onWheel = useCallback(
    (e) => {
      if (readOnly) return;
      e.preventDefault();
      const p = pointerToViewBox(svgRef.current, e);
      setView((v) => {
        const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        const w = Math.min(VIEWBOX_WIDTH * 1.5, Math.max(VIEWBOX_WIDTH * 0.12, v.w * factor));
        const h = w * (v.h / v.w);
        // Keep whatever is under the cursor exactly where it is.
        return { x: p.x - ((p.x - v.x) * w) / v.w, y: p.y - ((p.y - v.y) * h) / v.h, w, h };
      });
    },
    [readOnly]
  );

  // React attaches wheel passively, which forbids preventDefault, so bind it here.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || readOnly) return undefined;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel, readOnly]);

  const zoomBy = (factor) =>
    setView((v) => {
      const w = Math.min(VIEWBOX_WIDTH * 1.5, Math.max(VIEWBOX_WIDTH * 0.12, v.w * factor));
      const h = w * (v.h / v.w);
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });

  /* ---------------- pointer entry points ---------------- */

  const onCanvasPointerDown = (e) => {
    if (readOnly) return;
    const p = pointerToViewBox(svgRef.current, e);
    const panning = spaceHeld || e.button === 1 || e.altKey;

    if (panning) {
      gesture.current = { type: "pan", start: p, startView: view, movedLittle: false };
      return;
    }
    gesture.current = { type: "draw", start: p };
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const startMove = (e, item) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelect(item.id);
    const p = pointerToViewBox(svgRef.current, e);
    gesture.current = { type: "move", id: item.id, dx: p.x - item.x, dy: p.y - item.y };
  };

  const startHandle = (e, type) => {
    if (readOnly || !selected) return;
    e.stopPropagation();
    gesture.current = { type, id: selected.id, item: selected };
  };

  const scale = view.w / VIEWBOX_WIDTH; // handles keep a constant on-screen size

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-ink-900">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="block w-full"
        style={{
          aspectRatio: `${VIEWBOX_WIDTH} / ${worldHeight}`,
          touchAction: "none",
          cursor: readOnly ? "default" : spaceHeld ? "grab" : "crosshair",
        }}
        onPointerDown={onCanvasPointerDown}
      >
        {imageSrc ? (
          <image
            href={imageSrc}
            x="0"
            y="0"
            width={VIEWBOX_WIDTH}
            height={worldHeight}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            <rect x="0" y="0" width={VIEWBOX_WIDTH} height={worldHeight} fill="#111A2B" />
            <text
              x={VIEWBOX_WIDTH / 2}
              y={worldHeight / 2}
              textAnchor="middle"
              fontSize="18"
              fill="#64748B"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              Add a site photo to lay panels out
            </text>
          </>
        )}

        {arrays.map((a) => (
          <PanelArray
            key={a.id}
            array={a}
            spec={spec}
            selected={a.id === selectedId}
            readOnly={readOnly}
            onPointerDown={(e) => startMove(e, a)}
          />
        ))}

        {notes.map((n) => (
          <Note
            key={n.id}
            note={n}
            scale={scale}
            selected={n.id === selectedId}
            readOnly={readOnly}
            onPointerDown={(e) => startMove(e, n)}
          />
        ))}

        {draft && <DraftRect draft={draft} spec={spec} scale={scale} />}

        {selected && !readOnly && (
          <Handles
            array={selected}
            spec={spec}
            scale={scale}
            onResize={(e) => startHandle(e, "resize")}
            onRotate={(e) => startHandle(e, "rotate")}
          />
        )}
      </svg>

      {!readOnly && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-ink-900/85 p-1 text-white backdrop-blur">
          <ZoomButton label="Zoom out" onClick={() => zoomBy(1.25)}>
            −
          </ZoomButton>
          <button
            type="button"
            onClick={() => setView(fullView)}
            className="rounded px-2 py-1 font-mono text-[11px] text-slate-300 transition hover:bg-white/10"
          >
            {Math.round((VIEWBOX_WIDTH / view.w) * 100)}%
          </button>
          <ZoomButton label="Zoom in" onClick={() => zoomBy(1 / 1.25)}>
            +
          </ZoomButton>
        </div>
      )}
    </div>
  );
}

function ZoomButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded text-[15px] leading-none transition hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function PanelArray({ array: a, spec, selected, readOnly, onPointerDown }) {
  const { panelWidth: pw, panelHeight: ph, width, height } = arraySize(a, spec);

  const panels = [];
  for (let r = 0; r < a.rows; r += 1) {
    for (let c = 0; c < a.cols; c += 1) {
      panels.push(
        <rect
          key={`${r}-${c}`}
          x={c * (pw + PANEL_GAP)}
          y={r * (ph + PANEL_GAP)}
          width={pw}
          height={ph}
          rx="1"
          fill="#0F2744"
          fillOpacity="0.9"
          stroke="#7DD3FC"
          strokeWidth="0.7"
        />
      );
    }
  }

  return (
    <g
      transform={`translate(${a.x} ${a.y}) rotate(${a.rotation} ${width / 2} ${height / 2})`}
      onPointerDown={onPointerDown}
      style={{ cursor: readOnly ? "default" : "move" }}
    >
      <rect x={-1.5} y={-1.5} width={width + 3} height={height + 3} rx="1.5" fill="#000" fillOpacity="0.3" />
      {panels}
      {selected && !readOnly && (
        <rect
          x={-2}
          y={-2}
          width={width + 4}
          height={height + 4}
          rx="2"
          fill="none"
          stroke="#3163F5"
          strokeWidth="2"
        />
      )}
    </g>
  );
}

/** Corner and rotate grips, sized in screen terms so they stay grabbable at any zoom. */
function Handles({ array: a, spec, scale, onResize, onRotate }) {
  const { width, height } = arraySize(a, spec);
  const r = 6 * scale;
  const corner = toWorld(a, spec, width, height);
  const stem = 26 * scale;
  const knob = toWorld(a, spec, width / 2, -stem);
  const top = toWorld(a, spec, width / 2, 0);

  return (
    <g>
      <line x1={top.x} y1={top.y} x2={knob.x} y2={knob.y} stroke="#3163F5" strokeWidth={1.6 * scale} />
      <circle
        cx={knob.x}
        cy={knob.y}
        r={r}
        fill="#fff"
        stroke="#3163F5"
        strokeWidth={2 * scale}
        style={{ cursor: "grab" }}
        onPointerDown={onRotate}
      />
      <rect
        x={corner.x - r}
        y={corner.y - r}
        width={r * 2}
        height={r * 2}
        rx={1.5 * scale}
        fill="#fff"
        stroke="#3163F5"
        strokeWidth={2 * scale}
        style={{ cursor: "nwse-resize" }}
        onPointerDown={onResize}
      />
    </g>
  );
}

/** Live preview while dragging out a new array, with the panel count on it. */
function DraftRect({ draft, spec, scale }) {
  const x = Math.min(draft.x0, draft.x1);
  const y = Math.min(draft.y0, draft.y1);
  const w = Math.abs(draft.x1 - draft.x0);
  const h = Math.abs(draft.y1 - draft.y0);
  if (w < 4 && h < 4) return null;
  const { cols, rows } = fitPanels(w, h, spec);

  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="#3163F5" fillOpacity="0.18" stroke="#3163F5" strokeWidth={1.6 * scale} />
      <rect x={x} y={y - 20 * scale} width={64 * scale} height={16 * scale} rx={3 * scale} fill="#0B1220" fillOpacity="0.9" />
      <text
        x={x + 32 * scale}
        y={y - 8 * scale}
        textAnchor="middle"
        fontSize={11 * scale}
        fill="#fff"
        fontFamily="ui-monospace, monospace"
      >
        {cols} × {rows} = {cols * rows}
      </text>
    </g>
  );
}

function Note({ note, scale, selected, readOnly, onPointerDown }) {
  const text = note.text || "Note";
  const w = (Math.max(56, text.length * 7.4 + 18)) * scale;
  const hh = 24 * scale;

  return (
    <g
      transform={`translate(${note.x} ${note.y})`}
      onPointerDown={onPointerDown}
      style={{ cursor: readOnly ? "default" : "move" }}
    >
      <rect
        x="0"
        y="0"
        width={w}
        height={hh}
        rx={4 * scale}
        fill="#0B1220"
        fillOpacity="0.88"
        stroke={selected && !readOnly ? "#3163F5" : "#FFFFFF"}
        strokeOpacity={selected && !readOnly ? 1 : 0.35}
        strokeWidth={(selected && !readOnly ? 2.5 : 1) * scale}
      />
      <text
        x={w / 2}
        y={hh / 2 + 4.5 * scale}
        textAnchor="middle"
        fontSize={12 * scale}
        fill="#FFFFFF"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {text}
      </text>
      <line x1={w / 2} y1={hh} x2={w / 2} y2={hh + 10 * scale} stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth={1.5 * scale} />
      <circle cx={w / 2} cy={hh + 12 * scale} r={2.5 * scale} fill="#FFFFFF" fillOpacity="0.9" />
    </g>
  );
}
