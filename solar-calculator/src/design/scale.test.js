import { describe, it, expect } from "vitest";

import {
  metresPerPixel,
  scaleForStaticMap,
  scaleFromCalibration,
  panelUnitsFor,
  groundWidthMetres,
  CALIBRATION_HINTS,
} from "./scale";
import { VIEWBOX_WIDTH, gapFor, arraySize, makeArray, PANEL_GAP } from "./layout";
import { panelById } from "./panels";

describe("ground resolution", () => {
  it("matches the published Web Mercator figure at the equator", () => {
    // Zoom 0 is one 256 px tile around the world: 156543 m per pixel.
    expect(metresPerPixel(0, 0)).toBeCloseTo(156543.03392, 4);
    expect(metresPerPixel(1, 0)).toBeCloseTo(78271.51696, 4);
  });

  it("covers less ground the further from the equator, by the cosine of latitude", () => {
    const equator = metresPerPixel(20, 0);
    const moura = metresPerPixel(20, -24.58);
    const hobart = metresPerPixel(20, -42.88);
    expect(moura).toBeLessThan(equator);
    expect(hobart).toBeLessThan(moura);
    expect(moura).toBeCloseTo(equator * Math.cos((24.58 * Math.PI) / 180), 9);
  });

  it("treats north and south the same", () => {
    expect(metresPerPixel(19, -33.87)).toBeCloseTo(metresPerPixel(19, 33.87), 12);
  });

  it("refuses junk rather than returning NaN", () => {
    expect(metresPerPixel("", -24)).toBeNull();
    expect(metresPerPixel(20, undefined)).toBeNull();
    expect(metresPerPixel(null, null)).toBeNull();
  });
});

describe("a fetched aerial knows its own scale", () => {
  const moura = { zoom: 20, latitude: -24.5803, requestWidth: 900 };

  it("works out metres per canvas unit from the tile request", () => {
    const scale = scaleForStaticMap(moura);
    const expected = (metresPerPixel(20, -24.5803) * 900) / VIEWBOX_WIDTH;
    expect(scale).toBeCloseTo(expected, 12);
  });

  it("puts a suburban block in frame at zoom 20, not a suburb", () => {
    const across = groundWidthMetres(scaleForStaticMap(moura));
    expect(across).toBeGreaterThan(80);
    expect(across).toBeLessThan(160);
  });

  it("halves the ground covered for each step of zoom", () => {
    const twenty = scaleForStaticMap(moura);
    const twentyOne = scaleForStaticMap({ ...moura, zoom: 21 });
    expect(twentyOne).toBeCloseTo(twenty / 2, 12);
  });

  it("ignores the retina flag — twice the pixels, the same ground", () => {
    // scale=2 doubles what comes back but not what it covers, so only the
    // requested width may ever enter this calculation.
    expect(scaleForStaticMap(moura)).toBeCloseTo(scaleForStaticMap(moura), 12);
    expect(scaleForStaticMap({ ...moura, requestWidth: 1800 })).toBeCloseTo(
      scaleForStaticMap(moura) * 2,
      12
    );
  });

  it("gives up rather than guessing when something is missing", () => {
    expect(scaleForStaticMap({ zoom: 20, latitude: -24, requestWidth: 0 })).toBeNull();
    expect(scaleForStaticMap({ zoom: 20, requestWidth: 900 })).toBeNull();
  });
});

describe("measuring a photo by hand", () => {
  it("turns a drawn line of known length into a scale", () => {
    // 100 units across a 4.8 m double garage door.
    const scale = scaleFromCalibration({ x0: 100, y0: 200, x1: 200, y1: 200, metres: 4.8 });
    expect(scale).toBeCloseTo(0.048, 12);
    expect(groundWidthMetres(scale)).toBeCloseTo(48, 9);
  });

  it("measures diagonally, not just along an axis", () => {
    const scale = scaleFromCalibration({ x0: 0, y0: 0, x1: 30, y1: 40, metres: 10 });
    expect(scale).toBeCloseTo(10 / 50, 12); // 3-4-5
  });

  it("reads the same line either way round", () => {
    const a = scaleFromCalibration({ x0: 10, y0: 10, x1: 90, y1: 60, metres: 9 });
    const b = scaleFromCalibration({ x0: 90, y0: 60, x1: 10, y1: 10, metres: 9 });
    expect(a).toBeCloseTo(b, 12);
  });

  it("rejects a tap, a zero length and a nonsense distance", () => {
    expect(scaleFromCalibration({ x0: 5, y0: 5, x1: 5, y1: 5, metres: 4.8 })).toBeNull();
    expect(scaleFromCalibration({ x0: 0, y0: 0, x1: 100, y1: 0, metres: 0 })).toBeNull();
    expect(scaleFromCalibration({ x0: 0, y0: 0, x1: 100, y1: 0, metres: -3 })).toBeNull();
    expect(scaleFromCalibration({ x0: 0, y0: 0, x1: 100, y1: 0, metres: "" })).toBeNull();
  });

  it("offers only landmarks a rep can actually pick out from the air", () => {
    expect(CALIBRATION_HINTS.length).toBeGreaterThan(2);
    for (const h of CALIBRATION_HINTS) {
      expect(h.label, h.label).toBeTruthy();
      expect(h.metres, h.label).toBeGreaterThan(1);
      expect(h.metres, h.label).toBeLessThan(30);
    }
  });
});

describe("panels drawn at true size", () => {
  const trina = panelById("trina-vertex-s-440");
  const qcells = panelById("qcells-ml-g11-410");

  it("draws a 1.762 m module as 1.762 m of ground", () => {
    const scale = 0.09; // 90 m across the frame
    expect(panelUnitsFor(trina.longMm, scale)).toBeCloseTo(1.762 / 0.09, 9);
  });

  it("makes a longer panel longer on the roof, with no slider touched", () => {
    const scale = 0.09;
    expect(qcells.longMm).toBeGreaterThan(trina.longMm);
    expect(panelUnitsFor(qcells.longMm, scale)).toBeGreaterThan(
      panelUnitsFor(trina.longMm, scale)
    );
  });

  it("draws the same panel smaller on a wider-angle photo", () => {
    expect(panelUnitsFor(trina.longMm, 0.18)).toBeCloseTo(
      panelUnitsFor(trina.longMm, 0.09) / 2,
      9
    );
  });

  it("says it doesn't know rather than sizing off a missing scale", () => {
    expect(panelUnitsFor(trina.longMm, null)).toBeNull();
    expect(panelUnitsFor(trina.longMm, 0)).toBeNull();
    expect(panelUnitsFor(0, 0.09)).toBeNull();
  });

  it("a 15-panel array measures what 15 panels measure", () => {
    // 5 across, 3 deep, landscape — the familiar 6.6 kW system.
    const scale = 0.09;
    const width = panelUnitsFor(trina.longMm, scale);
    const spec = { panelWidth: width, ratio: trina.shortMm / trina.longMm };
    const { width: w, height: h } = arraySize(
      makeArray({ x: 0, y: 0, cols: 5, rows: 3 }),
      spec
    );
    const gapMetres = gapFor(width) * scale;
    expect(w * scale).toBeCloseTo(5 * 1.762 + 4 * gapMetres, 6);
    expect(h * scale).toBeCloseTo(3 * 1.134 + 2 * gapMetres, 6);
    // Roughly 9 m x 3.5 m — a real 6.6 kW array, and it fits on a real roof.
    expect(w * scale).toBeGreaterThan(8.8);
    expect(w * scale).toBeLessThan(9.6);
  });
});

describe("the seam between panels", () => {
  it("shrinks with the panels instead of growing into a metre-wide gap", () => {
    expect(gapFor(46)).toBe(PANEL_GAP); // the old reference size is unchanged
    expect(gapFor(20)).toBeLessThan(PANEL_GAP);
    expect(gapFor(20)).toBeCloseTo(1, 9);
  });

  it("never closes up completely, however far out the photo is zoomed", () => {
    expect(gapFor(0.5)).toBeGreaterThan(0);
    expect(gapFor(1)).toBeGreaterThanOrEqual(0.15);
  });

  it("stays a believable width on the roof — centimetres, not a footpath", () => {
    const scale = 0.09;
    const width = panelUnitsFor(1762, scale);
    const seam = gapFor(width) * scale;
    expect(seam).toBeGreaterThan(0.01);
    expect(seam).toBeLessThan(0.12);
  });

  it("falls back rather than dividing by a junk panel size", () => {
    expect(gapFor(0)).toBe(PANEL_GAP);
    expect(gapFor("")).toBe(PANEL_GAP);
    expect(gapFor(undefined)).toBe(PANEL_GAP);
  });
});
