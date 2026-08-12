import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  VIEWBOX_WIDTH,
  viewBoxHeight,
  arraySize,
  pointerToViewBox,
  toLocal,
  toWorld,
  resizeFromCorner,
  angleTo,
  normaliseAngle,
  fitPanels,
  makeArray,
  buildSteps,
  buildCopies,
  DEFAULT_PANEL_WIDTH,
} from "./layout";
import { snapPosition, snapRotation } from "./snap";

/**
 * The work surface.
 *
 * Direct manipulation throughout, with a small set of tools rather than a form
 * beside the roof. The mechanic is deliberately flat: there is no roof plane to
 * define before panels can go on, the way engineering-first tools work. Panels
 * go straight onto the photo.
 *
 *   SELECT:     drag an array ....... moves it, snapping to what is already there
 *               drag the photo ...... pans, so getting around while zoomed in is
 *                                     the same drag it is on any map
 *               side handle ......... runs the row out along the roof
 *               bottom handle ....... stacks more rows down it
 *               corner .............. both at once
 *               top knob ............ rotates (Shift snaps to 15°)
 *   PANEL tool: tap the roof ........ drops one panel there
 *               drag ................ lays a block of whole panels
 *   BUILD:      drag off an array ... repeats it across the roof, one whole
 *                                     block at a time, along its own angle
 *   ERASE:      tap an array ........ removes it
 *   MEASURE:    drag a line ......... sets the scale of the photo
 *
 * The select tool never CREATES anything, which is what lets a plain drag pan.
 * Laying panels is the panel tool's job, and that is the one place a drag on
 * open roof draws a block.
 *
 *   pinch on a trackpad ... zoom about the cursor (+ and − also zoom)
 *   space-drag, alt-drag or middle-drag ... pan from any tool, over anything
 *   arrows ... nudge, Shift for a bigger step
 *   Delete / Backspace ... remove      Escape ... deselect
 *
 * A panel dragged off the palette lands here too, through the browser's own
 * drag and drop.
 *
 * The image lives INSIDE the svg, so zoom and pan are one viewBox change rather
 * than two coordinate systems kept in step.
 */
export default function DesignCanvas({
  imageSrc,
  aspect,
  arrays,
  notes,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelRatio,
  panelGap,
  orientation = "landscape",
  selectedId,
  onSelect,
  onChange, // (id, patch)
  onCreate, // (array)
  onCreateMany, // (arrays) — the build tool lays several down at once
  onDelete,
  readOnly = false,
  tool = "select",
  onCalibrated, // ({ x0, y0, x1, y1 }) while the measure tool is active
  metresPerUnit = null,
}) {
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [, forceRender] = useState(0);
  const [draft, setDraft] = useState(null); // rectangle being dragged out
  const [ruler, setRuler] = useState(null); // measuring line
  const [guides, setGuides] = useState([]); // alignment lines, while snapping
  const [build, setBuild] = useState(null); // repeats being dragged out
  const [hoverId, setHoverId] = useState(null); // what the eraser is over
  const [spaceHeld, setSpaceHeld] = useState(false);

  const measuring = tool === "measure";
  const erasing = tool === "erase";
  const building = tool === "build";

  // One object describing how a panel is drawn, passed to every geometry call.
  const spec = useMemo(
    () => ({ panelWidth, ratio: panelRatio, orientation, gap: panelGap }),
    [panelWidth, panelRatio, orientation, panelGap]
  );

  const worldHeight = viewBoxHeight(aspect);
  const fullView = useMemo(
    () => ({ x: 0, y: 0, w: VIEWBOX_WIDTH, h: worldHeight }),
    [worldHeight]
  );
  const [view, setView] = useState(fullView);
  useEffect(() => setView(fullView), [fullView]);

  // The measuring line stays on screen while the rep types how long it is, and
  // clears the moment they finish or switch tools.
  useEffect(() => {
    if (!measuring) setRuler(null);
  }, [measuring]);

  useEffect(() => {
    if (!building) setBuild(null);
  }, [building]);

  const selected = arrays.find((a) => a.id === selectedId) ?? null;
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  // Snapping needs the live array list inside a listener that is bound once per
  // gesture, so it reads through a ref rather than through the closure.
  const latest = useRef({ arrays, spec, aspect });
  latest.current = { arrays, spec, aspect };

  /** One panel, centred where it was dropped rather than starting there. */
  const dropPanel = useCallback(
    (point) => {
      const { panelWidth: pw, panelHeight: ph } = arraySize(
        { cols: 1, rows: 1, orientation: spec.orientation },
        spec
      );
      onCreate(
        makeArray({
          x: point.x - pw / 2,
          y: point.y - ph / 2,
          cols: 1,
          rows: 1,
          orientation: spec.orientation,
        })
      );
    },
    [onCreate, spec]
  );

  /* ---------------- gestures ---------------- */

  useEffect(() => {
    if (readOnly) return undefined;

    const move = (e) => {
      const g = gesture.current;
      if (!g) return;
      const p = pointerToViewBox(svgRef.current, e);

      if (g.type === "pan") {
        // Anything past a few units is a drag rather than a tap, and a tap on
        // open roof still means "deselect".
        if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 3) g.moved = true;
        // The pointer should stay glued to the same spot on the photo, so the
        // view moves by the delta in world units, not screen pixels.
        setView((v) => ({
          ...v,
          x: g.startView.x - (p.x - g.start.x),
          y: g.startView.y - (p.y - g.start.y),
        }));
        return;
      }
      if (g.type === "build") {
        const local = toLocal(g.item, spec, p.x, p.y);
        setBuild({ item: g.item, ...buildSteps(g.item, spec, local.x, local.y) });
        return;
      }
      if (g.type === "draw") {
        setDraft({ x0: g.start.x, y0: g.start.y, x1: p.x, y1: p.y });
        return;
      }
      if (g.type === "measure") {
        setRuler({ x0: g.start.x, y0: g.start.y, x1: p.x, y1: p.y });
        return;
      }
      if (g.type === "move") {
        const { arrays: live, spec: liveSpec, aspect: liveAspect } = latest.current;
        const item = live.find((a) => a.id === g.id);
        const loose = { x: p.x - g.dx, y: p.y - g.dy };

        // Notes are labels, not layout — nothing to align them to.
        if (!item) {
          onChange(g.id, loose);
          return;
        }
        if (e.altKey) {
          // Holding alt is the universal "let me put it exactly there".
          setGuides([]);
          onChange(g.id, loose);
          return;
        }
        const result = snapPosition({
          array: { ...item, ...loose },
          spec: liveSpec,
          others: live.filter((a) => a.id !== g.id),
          aspect: liveAspect,
          tolerance: 6 * g.zoom,
          gap: liveSpec.gap ?? 0,
        });
        setGuides(result.guides);
        onChange(g.id, { x: result.x, y: result.y });
        return;
      }
      if (g.type === "resize" || g.type === "resize-x" || g.type === "resize-y") {
        const local = toLocal(g.item, spec, p.x, p.y);
        const axis = g.type === "resize-x" ? "x" : g.type === "resize-y" ? "y" : "both";
        onChange(g.id, resizeFromCorner(g.item, spec, local.x, local.y, axis));
        return;
      }
      if (g.type === "rotate") {
        const raw = angleTo(g.item, spec, p.x, p.y);
        if (e.shiftKey) {
          onChange(g.id, { rotation: normaliseAngle(Math.round(raw / 15) * 15) });
          return;
        }
        const others = latest.current.arrays.filter((a) => a.id !== g.id);
        onChange(g.id, { rotation: snapRotation(normaliseAngle(Math.round(raw)), others) });
      }
    };

    const up = (e) => {
      const g = gesture.current;
      gesture.current = null;
      setGuides([]);
      if (!g) return;

      if (g.type === "pan") {
        if (!g.moved && g.deselectOnTap) onSelect(null);
        forceRender((n) => n + 1);
        return;
      }
      if (g.type === "build") {
        const p = pointerToViewBox(svgRef.current, e);
        const local = toLocal(g.item, spec, p.x, p.y);
        const steps = buildSteps(g.item, spec, local.x, local.y);
        setBuild(null);
        const copies = buildCopies(g.item, spec, steps);
        if (copies.length > 0) onCreateMany?.(copies);
        return;
      }
      if (g.type === "measure") {
        const p = pointerToViewBox(svgRef.current, e);
        const line = { x0: g.start.x, y0: g.start.y, x1: p.x, y1: p.y };
        // A tap is not a measurement — leave the tool running so the rep can
        // just try again rather than being bounced out of it.
        if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) {
          setRuler(null);
          return;
        }
        setRuler(line);
        onCalibrated?.(line);
        return;
      }
      if (g.type === "draw") {
        const p = pointerToViewBox(svgRef.current, e);
        const w = Math.abs(p.x - g.start.x);
        const h = Math.abs(p.y - g.start.y);
        setDraft(null);

        // A tap drops a single panel with the panel tool, and means "nothing
        // selected" with the select tool.
        if (w < 6 && h < 6) {
          if (g.dropOnTap) dropPanel(g.start);
          else onSelect(null);
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
  }, [onChange, onCreate, onCreateMany, onSelect, onCalibrated, dropPanel, spec, readOnly]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    if (readOnly) return undefined;
    const down = (e) => {
      if (e.code === "Space") setSpaceHeld(true);
      // Never steal a keystroke meant for a text field.
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

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
      const nudge = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[e.key];
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

  /**
   * A plain scroll belongs to the PAGE, not the canvas. Scrolling used to zoom,
   * which meant reading down the screen past the roof zoomed it instead —
   * annoying on a mouse and infuriating on a trackpad, where two fingers is
   * just how you scroll.
   *
   * Pinch still zooms: browsers deliver a trackpad pinch as a wheel event with
   * ctrlKey set, which is the one case worth intercepting.
   */
  const onWheel = useCallback(
    (e) => {
      if (readOnly || !e.ctrlKey) return; // no preventDefault: let the page scroll
      e.preventDefault();
      const p = pointerToViewBox(svgRef.current, e);
      setView((v) => {
        // Pinch arrives as a stream of small deltas and a wheel notch as one
        // big one, so the step follows the delta rather than being fixed.
        const factor = Math.min(1.25, Math.max(0.8, Math.exp(e.deltaY * 0.0035)));
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

  const scale = view.w / VIEWBOX_WIDTH; // handles keep a constant on-screen size

  /* ---------------- pointer entry points ---------------- */

  const onCanvasPointerDown = (e) => {
    if (readOnly) return;
    const p = pointerToViewBox(svgRef.current, e);

    if (measuring) {
      gesture.current = { type: "measure", start: p };
      setRuler({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    if (spaceHeld || e.button === 1 || e.altKey) {
      gesture.current = { type: "pan", start: p, startView: view };
      return;
    }
    if (erasing) return; // nothing to erase out on the open roof

    // Dragging open roof with the panel tool lays a block. With every other
    // tool it moves the photo, which is what a drag means on a map and what
    // stops a rep papering the suburb in panels while trying to get around.
    if (tool !== "panel") {
      gesture.current = { type: "pan", start: p, startView: view, deselectOnTap: true };
      return;
    }
    gesture.current = { type: "draw", start: p, dropOnTap: true };
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const startMove = (e, item) => {
    if (readOnly) return;
    e.stopPropagation();
    if (erasing) {
      onDelete(item.id);
      return;
    }
    const p = pointerToViewBox(svgRef.current, e);

    if (building && item.kind === "array") {
      onSelect(item.id);
      gesture.current = { type: "build", id: item.id, item, start: p };
      setBuild({ item, across: 0, down: 0 });
      return;
    }
    onSelect(item.id);
    gesture.current = {
      type: "move",
      id: item.id,
      dx: p.x - item.x,
      dy: p.y - item.y,
      zoom: scale,
    };
  };

  const startHandle = (e, type) => {
    if (readOnly || !selected) return;
    e.stopPropagation();
    gesture.current = { type, id: selected.id, item: selected };
  };

  /* ---------------- dropping a panel off the palette ---------------- */

  const onDragOver = (e) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e) => {
    if (readOnly) return;
    e.preventDefault();
    dropPanel(pointerToViewBox(svgRef.current, e));
  };

  // The cursor over OPEN ROOF — arrays set their own, so this is the promise
  // the empty canvas is making about what a drag will do there.
  const cursor = readOnly
    ? "default"
    : erasing
      ? "not-allowed"
      : measuring || tool === "panel"
        ? "crosshair"
        : "grab";

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-ink-900">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="application"
        aria-label="Roof layout"
        className="block w-full"
        style={{
          aspectRatio: `${VIEWBOX_WIDTH} / ${worldHeight}`,
          touchAction: "none",
          cursor,
        }}
        onPointerDown={onCanvasPointerDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
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

        {/* While measuring, the roof underneath has to be reachable — a drag
            that starts on a panel is still a measurement, not a move. */}
        <g pointerEvents={measuring ? "none" : "auto"}>
          {arrays.map((a) => (
            <PanelArray
              key={a.id}
              array={a}
              spec={spec}
              scale={scale}
              selected={a.id === selectedId}
              doomed={erasing && a.id === hoverId}
              readOnly={readOnly}
              onPointerDown={(e) => startMove(e, a)}
              onPointerEnter={() => erasing && setHoverId(a.id)}
              onPointerLeave={() => setHoverId((id) => (id === a.id ? null : id))}
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
        </g>

        {guides.map((g, i) => (
          <Guide key={i} guide={g} scale={scale} />
        ))}

        {draft && <DraftRect draft={draft} spec={spec} scale={scale} />}
        {build && <BuildPreview build={build} spec={spec} scale={scale} />}
        {ruler && <Ruler line={ruler} scale={scale} metresPerUnit={metresPerUnit} />}

        {selected && !readOnly && tool === "select" && (
          <Handles
            array={selected}
            spec={spec}
            scale={scale}
            onResize={(e) => startHandle(e, "resize")}
            onResizeX={(e) => startHandle(e, "resize-x")}
            onResizeY={(e) => startHandle(e, "resize-y")}
            onRotate={(e) => startHandle(e, "rotate")}
          />
        )}
      </svg>

      {metresPerUnit > 0 && <ScaleBar viewWidth={view.w} metresPerUnit={metresPerUnit} />}

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

function PanelArray({
  array: a,
  spec,
  scale = 1,
  selected,
  doomed,
  readOnly,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}) {
  const { panelWidth: pw, panelHeight: ph, gap, width, height } = arraySize(a, spec);

  // Once panels draw at true size they can be a fifth of their old width, so
  // outlines and corner radii are taken off the panel rather than fixed —
  // a 0.7-unit stroke that reads as a hairline on a big panel becomes a thick
  // border on a small one.
  const line = Math.max(0.2, Math.min(0.7, pw * 0.017));
  const radius = Math.max(0.3, Math.min(1, pw * 0.025));

  const panels = [];
  for (let r = 0; r < a.rows; r += 1) {
    for (let c = 0; c < a.cols; c += 1) {
      panels.push(
        <rect
          key={`${r}-${c}`}
          x={c * (pw + gap)}
          y={r * (ph + gap)}
          width={pw}
          height={ph}
          rx={radius}
          fill={doomed ? "#7F1D1D" : "#0F2744"}
          fillOpacity="0.9"
          stroke={doomed ? "#FCA5A5" : "#7DD3FC"}
          strokeWidth={line}
        />
      );
    }
  }

  const pad = gap * 0.75;
  const halo = 2 * scale; // selection ring stays the same thickness on screen

  return (
    <g
      transform={`translate(${a.x} ${a.y}) rotate(${a.rotation} ${width / 2} ${height / 2})`}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{ cursor: readOnly ? "default" : "move" }}
    >
      <rect
        x={-pad}
        y={-pad}
        width={width + pad * 2}
        height={height + pad * 2}
        rx={pad}
        fill="#000"
        fillOpacity="0.3"
      />
      {panels}
      {(selected || doomed) && !readOnly && (
        <rect
          x={-halo}
          y={-halo}
          width={width + halo * 2}
          height={height + halo * 2}
          rx={halo}
          fill="none"
          stroke={doomed ? "#DC2626" : "#3163F5"}
          strokeWidth={halo}
        />
      )}
    </g>
  );
}

/**
 * Grips for building the array out.
 *
 * Three of them rather than one corner: the side handle runs a row out along
 * the roof, the bottom handle stacks rows down it, and the corner does both.
 * Each is constrained to its own axis, so dragging a row out never accidentally
 * adds a second row — which is the whole reason laying panels this way is
 * faster than editing numbers.
 */
function Handles({ array: a, spec, scale, onResize, onResizeX, onResizeY, onRotate }) {
  const { width, height } = arraySize(a, spec);
  const r = 6 * scale;
  const corner = toWorld(a, spec, width, height);
  const side = toWorld(a, spec, width, height / 2);
  const foot = toWorld(a, spec, width / 2, height);
  const stem = 26 * scale;
  const knob = toWorld(a, spec, width / 2, -stem);
  const top = toWorld(a, spec, width / 2, 0);

  // The edge grips are drawn as bars lying along the edge they belong to, so
  // which way a handle will build is readable before it is dragged.
  const grip = ({ point, cursor, onPointerDown, upright }) => (
    <rect
      x={point.x - (upright ? r * 0.55 : r)}
      y={point.y - (upright ? r : r * 0.55)}
      width={upright ? r * 1.1 : r * 2}
      height={upright ? r * 2 : r * 1.1}
      rx={1.5 * scale}
      fill="#fff"
      stroke="#3163F5"
      strokeWidth={2 * scale}
      style={{ cursor }}
      onPointerDown={onPointerDown}
    />
  );

  return (
    <g>
      <line
        x1={top.x}
        y1={top.y}
        x2={knob.x}
        y2={knob.y}
        stroke="#3163F5"
        strokeWidth={1.6 * scale}
      />
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
      {grip({ point: side, cursor: "ew-resize", onPointerDown: onResizeX, upright: true })}
      {grip({ point: foot, cursor: "ns-resize", onPointerDown: onResizeY, upright: false })}
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

/**
 * Ghosts of the repeats while the build tool is being dragged, with a running
 * panel count — so the rep is watching the number they actually care about
 * rather than counting rectangles after the fact.
 */
function BuildPreview({ build, spec, scale }) {
  const { item } = build;
  const copies = buildCopies(item, spec, build);
  if (copies.length === 0) return null;

  const { width, height } = arraySize(item, spec);
  const panels = (copies.length + 1) * item.cols * item.rows;
  const last = copies[copies.length - 1];
  const label = `${copies.length + 1} blocks · ${panels} panels`;
  const w = label.length * 6.2 * scale + 12 * scale;

  return (
    <g pointerEvents="none">
      {copies.map((c) => (
        <g
          key={c.id}
          transform={`translate(${c.x} ${c.y}) rotate(${c.rotation} ${width / 2} ${height / 2})`}
        >
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill="#3163F5"
            fillOpacity="0.3"
            stroke="#93C5FD"
            strokeWidth={1.4 * scale}
          />
        </g>
      ))}
      <rect
        x={last.x}
        y={last.y - 20 * scale}
        width={w}
        height={16 * scale}
        rx={3 * scale}
        fill="#0B1220"
        fillOpacity="0.9"
      />
      <text
        x={last.x + w / 2}
        y={last.y - 8 * scale}
        textAnchor="middle"
        fontSize={11 * scale}
        fill="#fff"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

/** An alignment line, shown so a snap reads as help rather than a glitch. */
function Guide({ guide, scale }) {
  const pad = 30 * scale;
  const props =
    guide.axis === "x"
      ? { x1: guide.at, y1: guide.from - pad, x2: guide.at, y2: guide.to + pad }
      : { x1: guide.from - pad, y1: guide.at, x2: guide.to + pad, y2: guide.at };

  return (
    <line
      {...props}
      stroke="#F472B6"
      strokeWidth={1.2 * scale}
      strokeDasharray={`${5 * scale} ${4 * scale}`}
      pointerEvents="none"
    />
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
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#3163F5"
        fillOpacity="0.18"
        stroke="#3163F5"
        strokeWidth={1.6 * scale}
      />
      <rect
        x={x}
        y={y - 20 * scale}
        width={64 * scale}
        height={16 * scale}
        rx={3 * scale}
        fill="#0B1220"
        fillOpacity="0.9"
      />
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

/**
 * The measuring line, drawn across something of known length. Shows what it
 * currently thinks that distance is, so a second calibration on an already-
 * scaled photo is a sanity check as much as a correction.
 */
function Ruler({ line, scale, metresPerUnit }) {
  const units = Math.hypot(line.x1 - line.x0, line.y1 - line.y0);
  const mid = { x: (line.x0 + line.x1) / 2, y: (line.y0 + line.y1) / 2 };
  const label = metresPerUnit > 0 ? `${(units * metresPerUnit).toFixed(1)} m` : "how long?";
  const w = 58 * scale;

  return (
    <g pointerEvents="none">
      <line
        x1={line.x0}
        y1={line.y0}
        x2={line.x1}
        y2={line.y1}
        stroke="#FBBF24"
        strokeWidth={2 * scale}
        strokeLinecap="round"
      />
      {[
        [line.x0, line.y0],
        [line.x1, line.y1],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={3.5 * scale}
          fill="#FBBF24"
          stroke="#0B1220"
          strokeWidth={scale}
        />
      ))}
      <rect
        x={mid.x - w / 2}
        y={mid.y - 9 * scale}
        width={w}
        height={17 * scale}
        rx={3 * scale}
        fill="#0B1220"
        fillOpacity="0.9"
      />
      <text
        x={mid.x}
        y={mid.y + 3.5 * scale}
        textAnchor="middle"
        fontSize={11 * scale}
        fill="#FDE68A"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

/** Rounded distances a scale bar is willing to show. */
const BAR_METRES = [1, 2, 5, 10, 20, 50, 100, 200];

/**
 * The corner scale bar — the plain proof that the drawing is to scale. Sized
 * against the current view, so it stays honest through zooming and panning.
 */
function ScaleBar({ viewWidth, metresPerUnit }) {
  const across = viewWidth * metresPerUnit; // metres visible right now
  // Widest round distance that still leaves the bar under a third of the frame.
  const metres = [...BAR_METRES].reverse().find((m) => m <= across / 3) ?? BAR_METRES[0];
  const width = (metres / across) * 100;

  // Top left rather than the cartographic convention of bottom left: aerials
  // carry their provider's watermark and coordinates along the bottom edge, and
  // a scale bar sitting in that is unreadable.
  //
  // The percentage resolves against the full canvas width, so the inset is a
  // margin rather than padding — otherwise the bar would quietly read long.
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3">
      <div style={{ width: `${width}%`, marginLeft: 12, minWidth: 40 }}>
        <div
          className="h-[6px] border-x-2 border-b-2 border-white/90"
          style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.9))" }}
        />
        <div
          className="pt-1 font-mono text-[10.5px] font-medium leading-none text-white"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}
        >
          {metres} m
        </div>
      </div>
    </div>
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
      <line
        x1={w / 2}
        y1={hh}
        x2={w / 2}
        y2={hh + 10 * scale}
        stroke="#FFFFFF"
        strokeOpacity="0.6"
        strokeWidth={1.5 * scale}
      />
      <circle cx={w / 2} cy={hh + 12 * scale} r={2.5 * scale} fill="#FFFFFF" fillOpacity="0.9" />
    </g>
  );
}
