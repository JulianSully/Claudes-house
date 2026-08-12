/**
 * Snapping — the difference between a layout that looks placed and one that
 * looks dropped.
 *
 * Eyeballing alignment on an aerial is slow and never quite right; the second
 * array always sits two pixels proud of the first. So while an array is being
 * dragged it looks for three things and pulls itself onto whichever is closest:
 *
 *   ALIGNMENT — its left, centre or right lines up with another array's left,
 *               centre or right. Same for top, middle and bottom.
 *   BUTTING   — its edge sits one panel margin away from another array's edge,
 *               which is how a second row goes on beside the first.
 *   ANGLE     — its rotation matches a neighbour's, so a roof laid out at 37°
 *               stays at 37° across every array on it.
 *
 * Everything works off upright bounding boxes rather than the rotated shapes.
 * That is deliberate: on screen, two arrays at different angles still read as
 * aligned when their extents line up, and the rep is looking at the screen.
 */

import { arrayBounds, VIEWBOX_WIDTH, viewBoxHeight } from "./layout";

/** How close counts as a snap, in viewBox units at 100% zoom. */
export const SNAP_UNITS = 6;

/** How close two rotations have to be before one adopts the other, in degrees. */
export const SNAP_DEGREES = 6;

/**
 * Work out where a dragged array should actually land.
 *
 * Returns the adjusted position plus the guide lines to draw, so the rep can
 * see WHY it jumped. A snap with no visible reason feels like a bug.
 */
export function snapPosition({
  array,
  spec,
  others,
  aspect,
  tolerance = SNAP_UNITS,
  gap = 0,
}) {
  const me = arrayBounds(array, spec);
  const targets = others.map((o) => arrayBounds(o, spec));

  const canvas = { width: VIEWBOX_WIDTH, height: viewBoxHeight(aspect) };

  const vertical = []; // candidate x adjustments
  const horizontal = []; // candidate y adjustments

  const consider = (list, delta, at, from, to) =>
    list.push({ delta, at, from, to, distance: Math.abs(delta) });

  for (const t of targets) {
    const spanY = [Math.min(t.top, me.top), Math.max(t.bottom, me.bottom)];
    const spanX = [Math.min(t.left, me.left), Math.max(t.right, me.right)];

    // Edge and centre alignment, both axes.
    for (const [mine, theirs] of [
      [me.left, t.left],
      [me.right, t.right],
      [me.cx, t.cx],
    ]) {
      consider(vertical, theirs - mine, theirs, ...spanY);
    }
    for (const [mine, theirs] of [
      [me.top, t.top],
      [me.bottom, t.bottom],
      [me.cy, t.cy],
    ]) {
      consider(horizontal, theirs - mine, theirs, ...spanX);
    }

    // Butting up beside it. With a panel margin set, the seam IS the margin —
    // offering a touching-edges snap as well would let panels be laid flush
    // against each other, which is exactly what the margin exists to prevent.
    consider(vertical, t.right + gap - me.left, t.right + gap, ...spanY);
    consider(vertical, t.left - gap - me.right, t.left - gap, ...spanY);
    consider(horizontal, t.bottom + gap - me.top, t.bottom + gap, ...spanX);
    consider(horizontal, t.top - gap - me.bottom, t.top - gap, ...spanX);
  }

  // The middle of the photo, which is usually the middle of the roof.
  consider(vertical, canvas.width / 2 - me.cx, canvas.width / 2, 0, canvas.height);
  consider(horizontal, canvas.height / 2 - me.cy, canvas.height / 2, 0, canvas.width);

  const bestX = nearest(vertical, tolerance);
  const bestY = nearest(horizontal, tolerance);

  const guides = [];
  if (bestX) guides.push({ axis: "x", at: bestX.at, from: bestX.from, to: bestX.to });
  if (bestY) guides.push({ axis: "y", at: bestY.at, from: bestY.from, to: bestY.to });

  return {
    x: array.x + (bestX?.delta ?? 0),
    y: array.y + (bestY?.delta ?? 0),
    guides,
    snapped: guides.length > 0,
  };
}

const nearest = (candidates, tolerance) =>
  candidates
    .filter((c) => c.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;

/**
 * Pull a rotation onto a neighbour's angle, or onto a right angle to it.
 *
 * A roof has one angle. Once one array is on it, every other array on that roof
 * wants the same number, and the second-most-wanted number is 90° off it for
 * the return face.
 */
export function snapRotation(rotation, others, tolerance = SNAP_DEGREES) {
  const candidates = [0];
  for (const o of others) {
    for (const step of [0, 90, -90, 180]) candidates.push(wrap(o.rotation + step));
  }

  let best = null;
  for (const c of candidates) {
    const distance = Math.abs(shortestTurn(rotation, c));
    if (distance <= tolerance && (best === null || distance < best.distance)) {
      best = { angle: c, distance };
    }
  }
  return best ? best.angle : rotation;
}

const wrap = (deg) => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

const shortestTurn = (a, b) => wrap(a - b);
