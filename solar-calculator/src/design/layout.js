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
    // Which way the roof plane faces and how steep it is. Both are for whoever
    // installs the system — the savings estimate runs on a flat sun-hours
    // figure — so they start unset rather than assuming a north-facing roof.
    facing: null,
    tilt: null,
  };
}

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
  // An explicit gap comes from the panel margin the rep set in millimetres,
  // which is only meaningful once the canvas knows its scale.
  const gap = s.gap ?? gapFor(longSide);

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
 * The build tool: repeat a block across the roof.
 *
 * Nothing on the canvas creates panels by being dragged across open roof. One
 * panel comes off the palette, and everything after that is this: drag off what
 * is already there and it stamps again and again. The repeats step by one whole
 * block plus the panel margin, and they step along the ARRAY'S OWN axes rather
 * than the screen's — so a panel set to a roof at 37° carries on down that roof,
 * not off sideways across the ridge.
 *
 * `localX/localY` is the pointer in the source array's own space, which is what
 * `toLocal` returns. Returns how many blocks across and down have been dragged;
 * either can be negative, because roofs get built leftwards and upwards too.
 */
export function buildSteps(a, spec, localX, localY, limit = 8) {
  const { width, height, gap } = arraySize(a, spec);
  const clamp = (n) => Math.max(-limit, Math.min(limit, n));
  return {
    across: clamp(Math.round((localX - width / 2) / (width + gap))),
    down: clamp(Math.round((localY - height / 2) / (height + gap))),
  };
}

/**
 * Where each repeat lands. The source block itself is never included — it is
 * already on the roof — and the total is capped so one wild drag can't stamp
 * out a hundred arrays that then have to be deleted one at a time.
 */
export function buildCopies(a, spec, { across, down }, max = 48) {
  const { width, height, gap } = arraySize(a, spec);
  const rad = (a.rotation * Math.PI) / 180;
  const stepX = width + gap;
  const stepY = height + gap;

  const xs = range(across);
  const ys = range(down);
  const copies = [];

  for (const j of ys) {
    for (const i of xs) {
      if (i === 0 && j === 0) continue;
      if (copies.length >= max) return copies;
      // Same size and angle as the source, so shifting the origin by the
      // rotated offset shifts the drawn shape by exactly that much.
      const d = rotatePoint(i * stepX, j * stepY, rad);
      copies.push({ ...a, id: nextId("arr"), x: a.x + d.x, y: a.y + d.y });
    }
  }
  return copies;
}

/** 0..n inclusive, counting the right way for a negative n. */
const range = (n) => {
  const out = [];
  const step = n < 0 ? -1 : 1;
  for (let i = 0; i !== n + step; i += step) out.push(i);
  return out;
};

/**
 * Did a stroke from p0 to p1 touch this array?
 *
 * The eraser needs this rather than a plain "is the pointer inside it" test,
 * because a pointer moving quickly reports its position every few frames and
 * can step clean over a small block between two of them. Testing the SEGMENT
 * between reports means a fast sweep rubs out everything under it, which is
 * what an eraser is supposed to do.
 *
 * Both endpoints go into the array's own space first, so a rotated block is
 * tested against an upright rectangle and the rotation costs nothing.
 */
export function strokeHitsArray(a, spec, p0, p1) {
  const { width, height } = arraySize(a, spec);
  const l0 = toLocal(a, spec, p0.x, p0.y);
  const l1 = toLocal(a, spec, p1 ? p1.x : p0.x, p1 ? p1.y : p0.y);
  return segmentHitsRect(l0, l1, width, height);
}

/** Liang–Barsky: does the segment cross the box from (0,0) to (w,h)? */
function segmentHitsRect(p0, p1, w, h) {
  const inside = (p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
  if (inside(p0) || inside(p1)) return true;

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let enter = 0;
  let leave = 1;

  // Each edge trims the run of the segment that can still be inside. If the
  // window ever closes, the segment passed the box by.
  const clip = (edge, distance) => {
    if (edge === 0) return distance >= 0; // parallel: only survives if not outside
    const t = distance / edge;
    if (edge < 0) {
      if (t > leave) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < leave) leave = t;
    }
    return true;
  };

  return (
    clip(-dx, p0.x) && clip(dx, w - p0.x) && clip(-dy, p0.y) && clip(dy, h - p0.y)
  );
}

/** The four corners of an array on the canvas, rotation included. */
export function arrayCorners(a, spec) {
  const { width, height } = arraySize(a, spec);
  return [
    toWorld(a, spec, 0, 0),
    toWorld(a, spec, width, 0),
    toWorld(a, spec, width, height),
    toWorld(a, spec, 0, height),
  ];
}

/**
 * Upright box around an array, however it is rotated. Snapping and alignment
 * guides work off this rather than the rotated shape: two arrays at different
 * angles still line up along the screen, which is what a rep is looking at.
 */
export function arrayBounds(a, spec) {
  const xs = [];
  const ys = [];
  for (const c of arrayCorners(a, spec)) {
    xs.push(c.x);
    ys.push(c.y);
  }
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
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
