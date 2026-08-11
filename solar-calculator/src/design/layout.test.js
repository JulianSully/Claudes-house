import { describe, it, expect } from "vitest";
import {
  makeArray,
  makeNote,
  arraySize,
  panelCount,
  layoutKw,
  keepOnCanvas,
  updateItem,
  removeItem,
  viewBoxHeight,
  DEFAULT_PANEL_WATTS,
  DEFAULT_PANEL_WIDTH,
  PANEL_ASPECT,
  PANEL_GAP,
  VIEWBOX_WIDTH,
  toWorld,
  toLocal,
  fitPanels,
  resizeFromCorner,
  angleTo,
  normaliseAngle,
  duplicateArray,
} from "./layout";

describe("arrays", () => {
  it("gives every array and note its own id", () => {
    const ids = [
      makeArray({ x: 0, y: 0 }).id,
      makeArray({ x: 0, y: 0 }).id,
      makeNote({ x: 0, y: 0 }).id,
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it("clamps silly row and column counts instead of accepting them", () => {
    expect(makeArray({ x: 0, y: 0, cols: 0, rows: -3 }).cols).toBe(1);
    expect(makeArray({ x: 0, y: 0, cols: 0, rows: -3 }).rows).toBe(1);
    expect(makeArray({ x: 0, y: 0, cols: 999 }).cols).toBe(40);
    expect(makeArray({ x: 0, y: 0, cols: 3.6 }).cols).toBe(4);
  });

  it("measures a footprint including the seams between panels", () => {
    const s = arraySize(makeArray({ x: 0, y: 0, cols: 4, rows: 2 }), 40);
    expect(s.width).toBeCloseTo(4 * 40 + 3 * PANEL_GAP, 9);
    expect(s.height).toBeCloseTo(2 * 40 * PANEL_ASPECT + 1 * PANEL_GAP, 9);
  });

  it("a single panel has no seams", () => {
    const s = arraySize(makeArray({ x: 0, y: 0, cols: 1, rows: 1 }), 40);
    expect(s.width).toBe(40);
    expect(s.height).toBeCloseTo(40 * PANEL_ASPECT, 9);
  });

  it("takes the panel size from the site, not the array", () => {
    // Every panel on a job is the same size; scaling one array and not another
    // would be drawing a lie.
    const a = makeArray({ x: 0, y: 0, cols: 2, rows: 1 });
    expect(a.panelWidth).toBeUndefined();
    expect(arraySize(a, 20).width).toBeLessThan(arraySize(a, 60).width);
  });
});

describe("the layout drives the system size", () => {
  it("counts every panel across every array", () => {
    const arrays = [
      makeArray({ x: 0, y: 0, cols: 4, rows: 2 }), // 8
      makeArray({ x: 0, y: 0, cols: 5, rows: 3 }), // 15
    ];
    expect(panelCount(arrays)).toBe(23);
  });

  it("turns panels into kilowatts", () => {
    const arrays = [makeArray({ x: 0, y: 0, cols: 4, rows: 4 })]; // 16 panels
    expect(layoutKw(arrays, 440)).toBeCloseTo(7.04, 9);
    expect(layoutKw(arrays, 415)).toBeCloseTo(6.64, 9);
  });

  it("is zero with nothing placed", () => {
    expect(panelCount([])).toBe(0);
    expect(layoutKw([], DEFAULT_PANEL_WATTS)).toBe(0);
  });

  it("shrugs off a junk wattage rather than producing NaN", () => {
    const arrays = [makeArray({ x: 0, y: 0, cols: 2, rows: 2 })];
    expect(layoutKw(arrays, "")).toBe(0);
    expect(layoutKw(arrays, "abc")).toBe(0);
    expect(layoutKw(arrays, null)).toBe(0);
  });

  it("falls back to the standard panel when no wattage is given at all", () => {
    // Omitting the argument is different from passing junk: it means "use the
    // default", which is what the default parameter is for.
    const arrays = [makeArray({ x: 0, y: 0, cols: 2, rows: 2 })];
    expect(layoutKw(arrays)).toBeCloseTo((4 * DEFAULT_PANEL_WATTS) / 1000, 9);
    expect(layoutKw(arrays, undefined)).toBeCloseTo(layoutKw(arrays), 9);
  });

  it("15 panels at 440 W is the familiar 6.6 kW", () => {
    expect(layoutKw([makeArray({ x: 0, y: 0, cols: 5, rows: 3 })], 440)).toBeCloseTo(6.6, 9);
  });
});

describe("staying on the canvas", () => {
  const aspect = 16 / 9;

  it("lets panels overhang the edge — roofs do", () => {
    const a = makeArray({ x: 10, y: 10, cols: 4, rows: 2 });
    const moved = keepOnCanvas({ ...a, x: -20 }, aspect);
    expect(moved.x).toBeLessThan(0);
  });

  it("stops an array being dragged completely out of sight", () => {
    const a = makeArray({ x: 0, y: 0, cols: 4, rows: 2 });
    const { width, height } = arraySize(a);
    const far = keepOnCanvas({ ...a, x: -9999, y: -9999 }, aspect);
    expect(far.x).toBeCloseTo(-width * 0.5, 9);
    expect(far.y).toBeCloseTo(-height * 0.5, 9);

    const away = keepOnCanvas({ ...a, x: 9999, y: 9999 }, aspect);
    expect(away.x).toBeCloseTo(VIEWBOX_WIDTH - width * 0.5, 9);
    expect(away.y).toBeCloseTo(viewBoxHeight(aspect) - height * 0.5, 9);
  });

  it("scales the canvas height to the image's shape", () => {
    expect(viewBoxHeight(16 / 9)).toBeCloseTo(562.5, 6);
    expect(viewBoxHeight(1)).toBe(1000);
    expect(viewBoxHeight(0)).toBeCloseTo(562.5, 6); // falls back, never divides by zero
    expect(viewBoxHeight(undefined)).toBeCloseTo(562.5, 6);
  });
});

describe("editing items", () => {
  it("patches only the item asked for", () => {
    const a = makeArray({ x: 0, y: 0, cols: 2, rows: 2 });
    const b = makeArray({ x: 5, y: 5, cols: 3, rows: 1 });
    const next = updateItem([a, b], b.id, { rotation: 30 });
    expect(next[0]).toBe(a); // untouched reference
    expect(next[1].rotation).toBe(30);
    expect(next[1].cols).toBe(3);
  });

  it("removes by id and leaves the rest alone", () => {
    const a = makeArray({ x: 0, y: 0 });
    const b = makeArray({ x: 0, y: 0 });
    expect(removeItem([a, b], a.id)).toEqual([b]);
    expect(removeItem([a, b], "nope")).toHaveLength(2);
  });

  it("defaults a panel to a sensible size and wattage", () => {
    expect(DEFAULT_PANEL_WIDTH).toBeGreaterThan(0);
    expect(DEFAULT_PANEL_WATTS).toBe(440);
    expect(PANEL_ASPECT).toBeLessThan(1); // panels are wider than they are tall
  });
});

/* ------------------------------------------------------------------ *
 * Direct manipulation — the maths behind dragging handles on a shape
 * that may be rotated. Getting this wrong makes the tool feel broken
 * rather than merely wrong, so it is pinned closely.
 * ------------------------------------------------------------------ */
describe("canvas geometry", () => {
  const PW = 40;

  it("round-trips a point through world and local space", () => {
    for (const rotation of [0, 25, -38, 90, 179]) {
      const a = { ...makeArray({ x: 120, y: 80, cols: 5, rows: 3 }), rotation };
      const world = toWorld(a, PW, 17, 9);
      const back = toLocal(a, PW, world.x, world.y);
      expect(back.x, `rot ${rotation}`).toBeCloseTo(17, 6);
      expect(back.y, `rot ${rotation}`).toBeCloseTo(9, 6);
    }
  });

  it("leaves an unrotated array's local space as a plain offset", () => {
    // Goes through the rotation maths at zero degrees, so compare as floats.
    const a = makeArray({ x: 100, y: 50, cols: 2, rows: 2 });
    const world = toWorld(a, PW, 0, 0);
    expect(world.x).toBeCloseTo(100, 9);
    expect(world.y).toBeCloseTo(50, 9);
  });

  it("fits whole panels to a dragged rectangle", () => {
    const { cols, rows } = fitPanels(4 * PW + 3 * PANEL_GAP, 2 * PW * PANEL_ASPECT + PANEL_GAP, PW);
    expect(cols).toBe(4);
    expect(rows).toBe(2);
  });

  it("never fits fewer than one panel, however small the drag", () => {
    expect(fitPanels(0, 0, PW)).toEqual({ cols: 1, rows: 1 });
    expect(fitPanels(-30, -12, PW)).toEqual({ cols: 1, rows: 1 });
  });

  it("keeps the near corner pinned while resizing a rotated array", () => {
    // The rotation pivot is the centre, and the centre moves as the array
    // grows — so without correction the shape slides out from under the
    // cursor the moment it is on an angle.
    for (const rotation of [0, 30, -45, 120]) {
      const a = { ...makeArray({ x: 200, y: 140, cols: 3, rows: 2 }), rotation };
      const before = toWorld(a, PW, 0, 0);
      const grown = resizeFromCorner(a, PW, 6 * PW, 4 * PW * PANEL_ASPECT);
      const after = toWorld(grown, PW, 0, 0);
      expect(after.x, `rot ${rotation}`).toBeCloseTo(before.x, 6);
      expect(after.y, `rot ${rotation}`).toBeCloseTo(before.y, 6);
      expect(grown.cols).toBeGreaterThan(a.cols);
    }
  });

  it("reads zero degrees as straight up from the centre", () => {
    const a = makeArray({ x: 0, y: 0, cols: 4, rows: 2 });
    const { width, height } = arraySize(a, PW);
    // A point directly above the centre is the handle's resting position.
    expect(angleTo(a, PW, width / 2, -50)).toBeCloseTo(0, 6);
    expect(angleTo(a, PW, width / 2, height + 50)).toBeCloseTo(180, 6);
  });

  it("keeps angles in a readable range rather than winding up", () => {
    expect(normaliseAngle(370)).toBeCloseTo(10, 9);
    expect(normaliseAngle(-370)).toBeCloseTo(-10, 9);
    expect(normaliseAngle(270)).toBeCloseTo(-90, 9);
    expect(normaliseAngle(-270)).toBeCloseTo(90, 9);
    expect(normaliseAngle(0)).toBe(0);
  });

  it("duplicates an array as a new object, offset so it isn't hidden", () => {
    const a = makeArray({ x: 10, y: 20, cols: 3, rows: 2 });
    const copy = duplicateArray(a);
    expect(copy.id).not.toBe(a.id);
    expect(copy.x).toBeGreaterThan(a.x);
    expect(copy.y).toBeGreaterThan(a.y);
    expect(copy.cols).toBe(3);
  });
});
