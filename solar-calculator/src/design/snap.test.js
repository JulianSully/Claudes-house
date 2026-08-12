import { describe, it, expect } from "vitest";

import { snapPosition, snapRotation, SNAP_UNITS } from "./snap";
import { makeArray, arrayBounds, arraySize, resizeFromCorner } from "./layout";
import {
  PANELS,
  CUSTOM_PANEL_ID,
  DEFAULT_PANEL_ID,
  panelById,
  panelLabel,
  searchPanels,
  orderByFavourites,
  toggleFavourite,
} from "./panels";

const SPEC = { panelWidth: 40, ratio: 0.64, gap: 2 };
const ASPECT = 16 / 9;

const at = (x, y, extra = {}) => ({ ...makeArray({ x, y, cols: 3, rows: 2 }), ...extra });

describe("snapping a dragged array", () => {
  it("lines an array's left edge up with its neighbour's", () => {
    const anchor = at(200, 100);
    const dragged = at(203, 300); // 3 units off, well inside the tolerance
    const result = snapPosition({ array: dragged, spec: SPEC, others: [anchor], aspect: ASPECT });

    expect(result.snapped).toBe(true);
    expect(arrayBounds({ ...dragged, ...result }, SPEC).left).toBeCloseTo(
      arrayBounds(anchor, SPEC).left,
      6
    );
  });

  it("leaves an array alone when nothing is near enough", () => {
    const anchor = at(200, 100);
    const dragged = at(600, 400);
    const result = snapPosition({ array: dragged, spec: SPEC, others: [anchor], aspect: ASPECT });

    expect(result.x).toBe(dragged.x);
    expect(result.y).toBe(dragged.y);
    expect(result.guides).toEqual([]);
  });

  it("butts a second block up one panel margin from the first", () => {
    const anchor = at(200, 100);
    const { width } = arraySize(anchor, SPEC);
    // Aiming a couple of units short of a clean seam beside it.
    const dragged = at(200 + width + SPEC.gap - 2, 100);
    const result = snapPosition({
      array: dragged,
      spec: SPEC,
      others: [anchor],
      aspect: ASPECT,
      gap: SPEC.gap,
    });

    const left = arrayBounds({ ...dragged, ...result }, SPEC).left;
    expect(left).toBeCloseTo(arrayBounds(anchor, SPEC).right + SPEC.gap, 6);
  });

  it("returns a guide for every axis it snapped, so the jump is explained", () => {
    const anchor = at(200, 100);
    const dragged = at(202, 102); // close on both axes
    const result = snapPosition({ array: dragged, spec: SPEC, others: [anchor], aspect: ASPECT });

    expect(result.guides.map((g) => g.axis).sort()).toEqual(["x", "y"]);
    for (const g of result.guides) {
      expect(Number.isFinite(g.at)).toBe(true);
      expect(g.to).toBeGreaterThanOrEqual(g.from);
    }
  });

  it("takes the closest candidate rather than the first one found", () => {
    const near = at(200, 400);
    const far = at(204, 400);
    const dragged = at(203.5, 100);
    const result = snapPosition({
      array: dragged,
      spec: SPEC,
      others: [near, far],
      aspect: ASPECT,
    });
    expect(result.x).toBeCloseTo(204, 6);
  });

  it("snaps a rotated array by what it covers on screen, not its corners", () => {
    // Two arrays at different angles still read as aligned when their extents
    // line up, which is what the rep is looking at.
    const anchor = at(200, 100, { rotation: 30 });
    const anchorLeft = arrayBounds(anchor, SPEC).left;
    // A wider block, so only the left edges are anywhere near each other and
    // the test is about the rotated bounds rather than a lucky centre match.
    const dragged = { ...makeArray({ x: anchorLeft + 3, y: 400, cols: 5, rows: 2 }) };
    const result = snapPosition({ array: dragged, spec: SPEC, others: [anchor], aspect: ASPECT });

    expect(arrayBounds({ ...dragged, ...result }, SPEC).left).toBeCloseTo(anchorLeft, 6);
  });

  it("finds the middle of the photo with nothing else placed", () => {
    const solo = at(0, 0);
    const { width } = arraySize(solo, SPEC);
    const nearMiddle = at(500 - width / 2 + 2, 0);
    const result = snapPosition({ array: nearMiddle, spec: SPEC, others: [], aspect: ASPECT });
    expect(arrayBounds({ ...nearMiddle, ...result }, SPEC).cx).toBeCloseTo(500, 6);
  });

  it("tightens with the zoom, so a snap is always the same distance on screen", () => {
    const anchor = at(200, 100);
    const dragged = at(204, 300);
    const zoomedIn = snapPosition({
      array: dragged,
      spec: SPEC,
      others: [anchor],
      aspect: ASPECT,
      tolerance: 1,
    });
    expect(zoomedIn.snapped).toBe(false);
    expect(SNAP_UNITS).toBeGreaterThan(1);
  });
});

describe("snapping rotation", () => {
  const others = [at(0, 0, { rotation: 37 })];

  it("adopts a neighbour's angle — a roof only has the one", () => {
    expect(snapRotation(39, others)).toBe(37);
    expect(snapRotation(34, others)).toBe(37);
  });

  it("also offers the square-on angle for the return face", () => {
    expect(snapRotation(126, others)).toBeCloseTo(127, 6);
    expect(snapRotation(-52, others)).toBeCloseTo(-53, 6);
  });

  it("finds true horizontal with nothing else placed", () => {
    expect(snapRotation(2, [])).toBe(0);
    expect(snapRotation(-3, [])).toBe(0);
  });

  it("leaves a deliberate angle alone", () => {
    expect(snapRotation(20, others)).toBe(20);
    expect(snapRotation(55, [])).toBe(55);
  });
});

describe("building an array out one axis at a time", () => {
  const a = { ...makeArray({ x: 100, y: 100, cols: 3, rows: 2 }), rotation: 0 };

  it("runs the row out without stacking a second one", () => {
    const grown = resizeFromCorner(a, SPEC, 6 * 42, 4 * 40 * 0.64, "x");
    expect(grown.cols).toBeGreaterThan(a.cols);
    expect(grown.rows).toBe(a.rows);
  });

  it("stacks rows down without widening the row", () => {
    const grown = resizeFromCorner(a, SPEC, 6 * 42, 4 * 40 * 0.64, "y");
    expect(grown.cols).toBe(a.cols);
    expect(grown.rows).toBeGreaterThan(a.rows);
  });

  it("does both from the corner, as it always did", () => {
    const grown = resizeFromCorner(a, SPEC, 6 * 42, 4 * 40 * 0.64, "both");
    expect(grown.cols).toBeGreaterThan(a.cols);
    expect(grown.rows).toBeGreaterThan(a.rows);
  });

  it("keeps the opposite corner pinned on every axis, at any angle", () => {
    for (const rotation of [0, 33, -70]) {
      for (const axis of ["x", "y", "both"]) {
        const item = { ...a, rotation };
        const before = arrayBounds(item, SPEC);
        const grown = resizeFromCorner(item, SPEC, 5 * 42, 3 * 26, axis);
        const after = arrayBounds(grown, SPEC);
        // The anchor is the array's own origin corner, so in an upright box the
        // growth is one-sided: it never runs back past where it started.
        expect(after.left, `${axis} @ ${rotation}`).toBeLessThanOrEqual(before.left + 0.001);
        expect(after.top, `${axis} @ ${rotation}`).toBeLessThanOrEqual(before.top + 0.001);
      }
    }
  });
});

describe("the panel margin", () => {
  it("is what sets the seam once the canvas knows its scale", () => {
    const wide = arraySize(makeArray({ x: 0, y: 0, cols: 3, rows: 1 }), { ...SPEC, gap: 8 });
    const tight = arraySize(makeArray({ x: 0, y: 0, cols: 3, rows: 1 }), { ...SPEC, gap: 1 });
    expect(wide.width - tight.width).toBeCloseTo(2 * 7, 9);
  });

  it("can be closed up entirely without the drawing breaking", () => {
    const flush = arraySize(makeArray({ x: 0, y: 0, cols: 4, rows: 1 }), { ...SPEC, gap: 0 });
    expect(flush.width).toBeCloseTo(4 * 40, 9);
  });
});

describe("the panel catalogue", () => {
  it("every entry has what the app needs, and no id is used twice", () => {
    for (const p of PANELS) {
      expect(p.id, p.id).toBeTruthy();
      expect(p.brand, p.id).toBeTruthy();
      expect(p.watts, p.id).toBeGreaterThan(100);
      expect(p.watts, p.id).toBeLessThan(1000);
      expect(p.longMm, p.id).toBeGreaterThan(p.shortMm);
      expect(panelLabel(p), p.id).toBeTruthy();
    }
    expect(new Set(PANELS.map((p) => p.id)).size).toBe(PANELS.length);
  });

  it("opens on a real panel, and keeps a custom entry for everything else", () => {
    expect(panelById(DEFAULT_PANEL_ID).id).toBe(DEFAULT_PANEL_ID);
    expect(panelById(CUSTOM_PANEL_ID).id).toBe(CUSTOM_PANEL_ID);
    expect(panelLabel(panelById(CUSTOM_PANEL_ID))).toBe("Custom panel");
  });

  it("searches brand, model and wattage together", () => {
    expect(searchPanels("jinko").every((p) => p.brand === "Jinko Solar")).toBe(true);
    expect(searchPanels("tiger neo").length).toBeGreaterThan(0);
    expect(searchPanels("440").every((p) => `${p.watts}`.includes("440"))).toBe(true);
  });

  it("narrows as more words are typed, rather than widening", () => {
    const one = searchPanels("longi").length;
    const two = searchPanels("longi 450").length;
    expect(two).toBeLessThan(one);
    expect(two).toBeGreaterThan(0);
  });

  it("returns the lot for an empty search rather than nothing", () => {
    expect(searchPanels("")).toHaveLength(PANELS.length);
    expect(searchPanels("   ")).toHaveLength(PANELS.length);
    expect(searchPanels(null)).toHaveLength(PANELS.length);
  });

  it("finds nothing for a brand it doesn't stock, instead of guessing", () => {
    expect(searchPanels("acme")).toHaveLength(0);
  });

  it("floats favourites to the top without losing anything", () => {
    const favourites = ["tindo-karra-440", "rec-alpha-pure-rx-450"];
    const ordered = orderByFavourites(PANELS, favourites);
    expect(ordered).toHaveLength(PANELS.length);
    expect(favourites).toContain(ordered[0].id);
    expect(favourites).toContain(ordered[1].id);
  });

  it("stars and unstars the same panel", () => {
    const once = toggleFavourite([], "tindo-karra-440");
    expect(once).toEqual(["tindo-karra-440"]);
    expect(toggleFavourite(once, "tindo-karra-440")).toEqual([]);
  });
});
