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
export const PANEL_GAP = 2; // the seam at the reference panel size

/**
 * The seam between panels, in viewBox units.
 *
 * It has to shrink with the panels. Once the canvas knows its real scale a
 * panel might only be 20 units long, and a fixed 2-unit seam would then be a
 * 20 cm gap between modules — visible on the drawing and wrong on the roof.
 * Five percent of the long edge is roughly a rail spacing, and it never
 * collapses to nothing, so the grid still reads as separate panels when zoomed
 * right out.
 */
export const gapFor = (longSide) => {
  const s = Number(longSide);
  if (!Number.isFinite(s) || s <= 0) return PANEL_GAP;
  return Math.max(0.15, Math.min(PANEL_GAP, s * 0.05));
};

export const VIEWBOX_WIDTH = 1000;
export const DEFAULT_ASPECT = 16 / 9;

export const viewBoxHeight = (aspect) =>
  VIEWBOX_WIDTH / (Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT);

let seq = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

export function makeArray({ x, y, cols = 4, rows = 2, rotation = 0, orientation = "landscape" }) {
  return {
    id: nextId("arr"),
    kind: "array",
    x,
    y,
    cols: clampCount(cols),
    rows: clampCount(rows),
    rotation,
    orientation,
  };
}

export const duplicateArray = (a, offset = 14) => ({
  ...a,
  id: nextId("arr"),
  x: a.x + offset,
  y: a.y + offset,
});

export function makeNote({ x, y, text = "" }) {
  return { id: nextId("note"), kind: "note", x, y, text };
}

const clampCount = (n) => Math.max(1, Math.min(40, Math.round(Number(n) || 1)));

/**
 * Overall footprint of an array in viewBox units, gaps included.
 *
 * Panel width is a property of the SITE, not of each array — every panel on a
 * job is the same physical size, so scaling one array and not another would be
 * drawing a lie. It is passed in rather than stored per array.
 */
export function arraySize(a, spec = {}) {
  // Tolerates being handed a plain number, which is all it used to take.
  const s = typeof spec === "number" ? { panelWidth: spec } : spec;
  const longSide = s.panelWidth ?? a.panelWidth ?? DEFAULT_PANEL_WIDTH;
  const ratio = s.ratio ?? PANEL_ASPECT;

  // The long edge runs across in landscape and down in portrait.
  const portrait = (a.orientation ?? s.orientation ?? "landscape") === "portrait";
  const pw = portrait ? longSide * ratio : longSide;
  const ph = portrait ? longSide : longSide * ratio;
  const gap = gapFor(longSide);

  return {
    panelWidth: pw,
    panelHeight: ph,
    gap,
    width: a.cols * pw + (a.cols - 1) * gap,
    height: a.rows * ph + (a.rows - 1) * gap,
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
export function keepOnCanvas(a, aspect, spec) {
  const h = viewBoxHeight(aspect);
  const { width, height } = arraySize(a, spec);
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


/* ------------------------------------------------------------------ *
 * Geometry for direct manipulation — dragging handles on a rotated shape.
 * ------------------------------------------------------------------ */

const rotatePoint = (px, py, radians) => ({
  x: px * Math.cos(radians) - py * Math.sin(radians),
  y: px * Math.sin(radians) + py * Math.cos(radians),
});

/** Where a point in the array's own unrotated space lands on the canvas. */
export function toWorld(a, spec, localX, localY) {
  const { width, height } = arraySize(a, spec);
  const rad = (a.rotation * Math.PI) / 180;
  const centre = { x: a.x + width / 2, y: a.y + height / 2 };
  const d = rotatePoint(localX - width / 2, localY - height / 2, rad);
  return { x: centre.x + d.x, y: centre.y + d.y };
}

/** The inverse: a canvas point expressed in the array's own space. */
export function toLocal(a, spec, worldX, worldY) {
  const { width, height } = arraySize(a, spec);
  const rad = (-a.rotation * Math.PI) / 180;
  const centre = { x: a.x + width / 2, y: a.y + height / 2 };
  const d = rotatePoint(worldX - centre.x, worldY - centre.y, rad);
  return { x: d.x + width / 2, y: d.y + height / 2 };
}

/**
 * How many whole panels fit in a dragged rectangle. At least one either way —
 * a stray click should still leave a panel behind rather than nothing.
 */
export function fitPanels(width, height, spec = {}) {
  const s = typeof spec === "number" ? { panelWidth: spec } : spec;
  const longSide = s.panelWidth ?? DEFAULT_PANEL_WIDTH;
  const ratio = s.ratio ?? PANEL_ASPECT;
  const portrait = (s.orientation ?? "landscape") === "portrait";
  const pw = portrait ? longSide * ratio : longSide;
  const ph = portrait ? longSide : longSide * ratio;
  const gap = gapFor(longSide);
  return {
    cols: clampCount(Math.max(1, Math.round((Math.abs(width) + gap) / (pw + gap)))),
    rows: clampCount(Math.max(1, Math.round((Math.abs(height) + gap) / (ph + gap)))),
  };
}

/**
 * Resize an array by dragging its far corner, keeping the NEAR corner pinned.
 * Without this the shape drifts under the cursor whenever it is rotated,
 * because the rotation pivot is the centre and the centre moves as it grows.
 */
export function resizeFromCorner(a, spec, localX, localY) {
  const anchor = toWorld(a, spec, 0, 0);
  const { cols, rows } = fitPanels(localX, localY, { ...spec, orientation: a.orientation });
  const next = { ...a, cols, rows };

  const { width, height } = arraySize(next, spec);
  const rad = (next.rotation * Math.PI) / 180;
  const d = rotatePoint(-width / 2, -height / 2, rad);
  return { ...next, x: anchor.x - width / 2 - d.x, y: anchor.y - height / 2 - d.y };
}

/** Angle from an array's centre to a point, as a compass-style rotation. */
export function angleTo(a, spec, worldX, worldY) {
  const { width, height } = arraySize(a, spec);
  const centre = { x: a.x + width / 2, y: a.y + height / 2 };
  const deg = (Math.atan2(worldY - centre.y, worldX - centre.x) * 180) / Math.PI;
  return deg + 90; // handle sits above the shape, so straight up is zero
}

export const normaliseAngle = (deg) => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};
