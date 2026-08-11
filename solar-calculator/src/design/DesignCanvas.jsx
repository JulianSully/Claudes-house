import { useEffect, useRef, useState } from "react";

import {
  VIEWBOX_WIDTH,
  viewBoxHeight,
  arraySize,
  keepOnCanvas,
  pointerToViewBox,
  PANEL_GAP,
} from "./layout";

/**
 * The work surface: the site image with panel arrays and notes laid over it.
 *
 * Flat 2D, deliberately. A rep is placing panels on a roof they can see, not
 * modelling a building — a surface that rotates in three axes would make that
 * harder, not easier.
 *
 * Everything is one SVG over the image. Pointer coordinates convert through the
 * SVG's own screen matrix, so dragging stays true at any rendered size, and the
 * same markup scales into the PDF.
 */
export default function DesignCanvas({
  imageSrc,
  aspect,
  arrays,
  notes,
  selectedId,
  onSelect,
  onChange, // (id, patch)
  tool, // "select" | "array" | "note"
  onCanvasClick, // (point) — placing a new item
  readOnly = false,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const h = viewBoxHeight(aspect);

  // Pointer capture keeps the drag alive when the cursor outruns the shape,
  // which it will — panels are small and roofs are fiddly.
  useEffect(() => {
    if (!dragging) return undefined;

    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const p = pointerToViewBox(svgRef.current, e);
      onChange(d.id, { x: p.x - d.dx, y: p.y - d.dy });
    };
    const up = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, onChange]);

  const startDrag = (e, item) => {
    if (readOnly || tool !== "select") return;
    e.stopPropagation();
    onSelect(item.id);
    const p = pointerToViewBox(svgRef.current, e);
    dragRef.current = { id: item.id, dx: p.x - item.x, dy: p.y - item.y };
    setDragging(true);
  };

  const handleCanvasPointerDown = (e) => {
    if (readOnly) return;
    if (tool === "select") {
      onSelect(null);
      return;
    }
    onCanvasClick(pointerToViewBox(svgRef.current, e));
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-800">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt="Site"
          className="block w-full select-none"
          style={{ aspectRatio: `${VIEWBOX_WIDTH} / ${h}`, objectFit: "cover" }}
          draggable={false}
        />
      ) : (
        <div
          className="grid w-full place-items-center bg-slate-800 text-center text-slate-400"
          style={{ aspectRatio: `${VIEWBOX_WIDTH} / ${h}` }}
        >
          <div className="px-6">
            <p className="text-[13px] font-medium">No site image yet</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Add the address and a photo or aerial view under Customer &amp; site, then
              lay the panels out here.
            </p>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${h}`}
        className="absolute inset-0 h-full w-full"
        style={{
          cursor: readOnly ? "default" : tool === "select" ? "default" : "crosshair",
          touchAction: "none",
        }}
        onPointerDown={handleCanvasPointerDown}
      >
        {arrays.map((a) => (
          <PanelArray
            key={a.id}
            array={a}
            selected={a.id === selectedId}
            readOnly={readOnly}
            onPointerDown={(e) => startDrag(e, a)}
          />
        ))}

        {notes.map((n) => (
          <Note
            key={n.id}
            note={n}
            selected={n.id === selectedId}
            readOnly={readOnly}
            onPointerDown={(e) => startDrag(e, n)}
          />
        ))}
      </svg>
    </div>
  );
}

function PanelArray({ array: a, selected, readOnly, onPointerDown }) {
  const { panelWidth: pw, panelHeight: ph, width, height } = arraySize(a);

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
          rx="1.5"
          fill="#0F2744"
          fillOpacity="0.92"
          stroke="#7DD3FC"
          strokeWidth="0.9"
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
      {/* A slightly larger backing plate reads as the mounting frame and gives
          a bigger target than the panels themselves. */}
      <rect
        x={-2}
        y={-2}
        width={width + 4}
        height={height + 4}
        rx="2"
        fill="#000"
        fillOpacity="0.25"
      />
      {panels}
      {selected && !readOnly && (
        <rect
          x={-4}
          y={-4}
          width={width + 8}
          height={height + 8}
          rx="3"
          fill="none"
          stroke="#3163F5"
          strokeWidth="2.5"
        />
      )}
    </g>
  );
}

function Note({ note, selected, readOnly, onPointerDown }) {
  const text = note.text || "Note";
  // SVG has no text metrics before paint, so the plate is sized from character
  // count. Generous enough that ordinary labels never overflow it.
  const w = Math.max(56, text.length * 7.4 + 18);
  const hh = 24;

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
        rx="4"
        fill="#0B1220"
        fillOpacity="0.88"
        stroke={selected && !readOnly ? "#3163F5" : "#FFFFFF"}
        strokeOpacity={selected && !readOnly ? 1 : 0.35}
        strokeWidth={selected && !readOnly ? 2.5 : 1}
      />
      <text
        x={w / 2}
        y={hh / 2 + 4.5}
        textAnchor="middle"
        fontSize="12"
        fill="#FFFFFF"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {text}
      </text>
      {/* A stem so the label points at what it is labelling. */}
      <line x1={w / 2} y1={hh} x2={w / 2} y2={hh + 10} stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx={w / 2} cy={hh + 12} r="2.5" fill="#FFFFFF" fillOpacity="0.9" />
    </g>
  );
}
