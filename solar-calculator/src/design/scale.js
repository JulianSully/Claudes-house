/**
 * Real-world scale for the canvas — how many metres one viewBox unit covers.
 *
 * Once that is known, panels draw themselves at their true size: a 1.76 m
 * module is 1.76 m on the roof, whatever brand is chosen and whichever way it
 * is mounted. No slider, no eyeballing.
 *
 * Two ways to know it:
 *
 *   1. FETCHED SATELLITE TILE — exact. Web Mercator tiles have a known ground
 *      resolution at a given zoom and latitude, so the maths below is the
 *      answer rather than an estimate.
 *   2. UPLOADED PHOTO — unknowable from the file, so the rep draws a line
 *      across something they know the length of and types the metres. One
 *      gesture, then everything else is to scale.
 */

import { VIEWBOX_WIDTH } from "./layout";

/** Ground covered by one pixel of a Web Mercator tile at the equator, zoom 0. */
const EQUATOR_METRES_PER_PIXEL = 156543.03392;

/**
 * A number, or NaN. Plain `Number()` turns null, undefined and "" into zero,
 * which here would mean "zoom 0, on the equator" — a scale off by a factor of a
 * million rather than an honest "don't know".
 */
const numeric = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Metres per pixel at a given zoom and latitude. Tiles cover less ground the
 * further from the equator you go, which is why latitude is in here — the same
 * zoom is a different scale in Darwin and Hobart.
 */
export function metresPerPixel(zoom, latitude) {
  const z = numeric(zoom);
  const lat = numeric(latitude);
  if (Number.isNaN(z) || Number.isNaN(lat)) return null;
  return (EQUATOR_METRES_PER_PIXEL * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/**
 * Scale for a static map image, in metres per viewBox unit.
 *
 * `requestWidth` is the width asked of the provider in CSS pixels — the
 * `scale=2` retina flag doubles the pixels returned but covers the same
 * ground, so it must not enter this calculation.
 */
export function scaleForStaticMap({ zoom, latitude, requestWidth }) {
  const mpp = metresPerPixel(zoom, latitude);
  if (mpp === null || !(requestWidth > 0)) return null;
  return (mpp * requestWidth) / VIEWBOX_WIDTH;
}

/**
 * Scale from a line the rep drew across something of known length.
 * Returns null rather than a nonsense number for a zero-length line.
 */
export function scaleFromCalibration({ x0, y0, x1, y1, metres }) {
  const units = Math.hypot(x1 - x0, y1 - y0);
  const m = Number(metres);
  if (!(units > 0.5) || !Number.isFinite(m) || m <= 0) return null;
  return m / units;
}

/** A panel's long edge in viewBox units, at true size. */
export function panelUnitsFor(longMm, metresPerUnit) {
  if (!(metresPerUnit > 0) || !(longMm > 0)) return null;
  return longMm / 1000 / metresPerUnit;
}

/** How wide the whole image is on the ground — useful as a sanity check. */
export const groundWidthMetres = (metresPerUnit) =>
  metresPerUnit > 0 ? metresPerUnit * VIEWBOX_WIDTH : null;

/** Things a rep can measure off an aerial without getting out of the car. */
export const CALIBRATION_HINTS = [
  { label: "Single garage door", metres: 2.4 },
  { label: "Double garage door", metres: 4.8 },
  { label: "A car, end to end", metres: 4.5 },
  { label: "Suburban street, kerb to kerb", metres: 9 },
];
