/**
 * The roof layout: panel arrays and annotations placed over the site image.
 *
 * The point of this screen is not engineering accuracy — it is that the
 * customer sees panels on THEIR roof, and that the rep stops typing a system
 * size by hand. Place 16 panels at 440 W and the quote becomes a 7.04 kW
 * system. The layout drives the number, not the other way round.
 *
 * COORDINATES. Everything lives in the viewBox units of an SVG laid over the
 * image: 1000 wide, and however tall the image's aspect ratio makes it. One
 * uniform coordinate system means rotation behaves, drag maths stays simple,
 * and the whole layout scales to any rendered size — including the PDF.
 */

/** A 440 W panel is the common size on Australian residential roofs today. */
export const DEFAULT_PANEL_WATTS = 440;

/** Roughly 1.76 m x 1.13 m, so a panel is about 0.64 as tall as it is wide. */
export const PANEL_ASPECT = 0.64;

export const DEFAULT_PANEL_WIDTH = 46; // viewBox units
export const PANEL_GAP = 2; // a visible seam between panels, as installers leave

export const VIEWBOX_WIDTH = 1000;
export const DEFAULT_ASPECT = 16 / 9;

export const viewBoxHeight = (aspect) =>
  VIEWBOX_WIDTH / (Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT);

let seq = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

export function makeArray({ x, y, cols = 4, rows = 2, panelWidth = DEFAULT_PANEL_WIDTH }) {
  return {
    id: nextId("arr"),
    kind: "array",
    x,
    y,
    cols: clampCount(cols),
    rows: clampCount(rows),
    rotation: 0,
    panelWidth,
  };
}

export function makeNote({ x, y, text = "" }) {
  return { id: nextId("note"), kind: "note", x, y, text };
}

const clampCount = (n) => Math.max(1, Math.min(40, Math.round(Number(n) || 1)));

/** Overall footprint of an array in viewBox units, gaps included. */
export function arraySize(a) {
  const pw = a.panelWidth;
  const ph = pw * PANEL_ASPECT;
  return {
    panelWidth: pw,
    panelHeight: ph,
    width: a.cols * pw + (a.cols - 1) * PANEL_GAP,
    height: a.rows * ph + (a.rows - 1) * PANEL_GAP,
  };
}

export const panelCount = (arrays) =>
  arrays.reduce((total, a) => total + a.cols * a.rows, 0);

/** System size in kW, straight off the layout. */
export const layoutKw = (arrays, watts = DEFAULT_PANEL_WATTS) =>
  (panelCount(arrays) * (Number(watts) || 0)) / 1000;

/**
 * Nudge an array so it stays reachable on the canvas. Deliberately loose — a
 * roof runs to the edge of the frame, so panels are allowed to overhang; this
 * only stops one being dragged completely out of sight.
 */
export function keepOnCanvas(a, aspect) {
  const h = viewBoxHeight(aspect);
  const { width, height } = arraySize(a);
  return {
    ...a,
    x: Math.max(-width * 0.5, Math.min(VIEWBOX_WIDTH - width * 0.5, a.x)),
    y: Math.max(-height * 0.5, Math.min(h - height * 0.5, a.y)),
  };
}

export function updateItem(items, id, patch) {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

export const removeItem = (items, id) => items.filter((i) => i.id !== id);

/**
 * Convert a pointer event to viewBox coordinates. Uses the SVG's own screen
 * matrix, so it stays correct at any rendered size and after any CSS scaling.
 */
export function pointerToViewBox(svg, event) {
  if (!svg) return { x: 0, y: 0 };
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = point.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
