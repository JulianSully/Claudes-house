import { describe, it, expect } from "vitest";
import { buildProjection, PROJECTION_YEARS, DEFAULT_PRICE_RISE } from "./projection";

const base = { annualBill: 2000, annualSaving: 1400, systemCost: 6500 };

describe("the twenty-year projection", () => {
  it("runs for twenty years by default, at 5% a year", () => {
    const p = buildProjection(base);
    expect(PROJECTION_YEARS).toBe(20);
    expect(DEFAULT_PRICE_RISE).toBe(5);
    expect(p.rows).toHaveLength(20);
    expect(p.rows[0].year).toBe(1);
    expect(p.rows[19].year).toBe(20);
  });

  it("starts year one at today's prices, not next year's", () => {
    const p = buildProjection(base);
    expect(p.rows[0].withoutSolar).toBeCloseTo(2000, 9);
    expect(p.rows[0].withSolar).toBeCloseTo(600, 9);
  });

  it("compounds the bill at the rise rate", () => {
    const p = buildProjection(base);
    expect(p.rows[1].withoutSolar).toBeCloseTo(2000 * 1.05, 9);
    expect(p.rows[19].withoutSolar).toBeCloseTo(2000 * 1.05 ** 19, 6);
  });

  it("grows the saving at the same rate as the bill", () => {
    // Avoiding a kWh is worth whatever that kWh now costs, so the gap widens
    // by exactly the same factor rather than staying flat.
    const p = buildProjection(base);
    for (const r of p.rows) {
      expect(r.saved).toBeCloseTo(r.withoutSolar - r.withSolar, 9);
    }
    expect(p.rows[19].saved).toBeCloseTo(1400 * 1.05 ** 19, 6);
  });

  it("charges the system price to the running total up front", () => {
    const p = buildProjection(base);
    expect(p.rows[0].cumulativeWith).toBeCloseTo(6500 + 600, 9);
    expect(p.rows[0].cumulativeWithout).toBeCloseTo(2000, 9);
  });

  it("accumulates both sides correctly", () => {
    const p = buildProjection(base);
    const sumWithout = p.rows.reduce((a, r) => a + r.withoutSolar, 0);
    const sumWith = p.rows.reduce((a, r) => a + r.withSolar, 0);
    expect(p.totalWithout).toBeCloseTo(sumWithout, 6);
    expect(p.totalWith).toBeCloseTo(sumWith + 6500, 6);
    expect(p.totalSaved).toBeCloseTo(p.totalWithout - p.totalWith, 6);
  });

  it("finds the year the system has paid for itself", () => {
    const p = buildProjection(base);
    expect(p.breakEvenYear).toBeGreaterThan(0);
    const row = p.rows[p.breakEvenYear - 1];
    expect(row.cumulativeWith).toBeLessThanOrEqual(row.cumulativeWithout);
    // …and the year before it had not yet crossed.
    if (p.breakEvenYear > 1) {
      const prior = p.rows[p.breakEvenYear - 2];
      expect(prior.cumulativeWith).toBeGreaterThan(prior.cumulativeWithout);
    }
  });

  it("crosses over sooner when power prices climb faster", () => {
    const slow = buildProjection({ ...base, risePercent: 0 });
    const fast = buildProjection({ ...base, risePercent: 10 });
    expect(fast.breakEvenYear).toBeLessThanOrEqual(slow.breakEvenYear);
    expect(fast.totalSaved).toBeGreaterThan(slow.totalSaved);
  });

  it("never crosses over when the system costs more than it can ever save", () => {
    const p = buildProjection({ annualBill: 500, annualSaving: 50, systemCost: 90000 });
    expect(p.breakEvenYear).toBeNull();
    expect(p.totalSaved).toBeLessThan(0);
  });

  it("bottoms the remaining bill out at zero rather than going negative", () => {
    const p = buildProjection({ annualBill: 1000, annualSaving: 2500, systemCost: 8000 });
    expect(p.rows.every((r) => r.withSolar === 0)).toBe(true);
    expect(p.rows[19].saved).toBeCloseTo(1000 * 1.05 ** 19, 6);
  });

  it("handles a flat 0% rise as plain repetition", () => {
    const p = buildProjection({ ...base, risePercent: 0 });
    expect(p.rows.every((r) => Math.abs(r.withoutSolar - 2000) < 1e-9)).toBe(true);
    expect(p.totalWithout).toBeCloseTo(2000 * 20, 6);
  });

  it("returns zeroes rather than NaN for empty inputs", () => {
    const p = buildProjection({ annualBill: "", annualSaving: undefined, systemCost: NaN });
    expect(p.totalWithout).toBe(0);
    expect(p.totalWith).toBe(0);
    for (const r of p.rows) {
      expect(Number.isFinite(r.withoutSolar)).toBe(true);
      expect(Number.isFinite(r.cumulativeWith)).toBe(true);
    }
  });

  it("matches a hand-worked case", () => {
    // $39,190 system saving $6,492 a year against a $9,000 annual bill.
    const p = buildProjection({ annualBill: 9000, annualSaving: 6492, systemCost: 39190 });
    expect(p.rows[0].withSolar).toBeCloseTo(2508, 9);
    // Year 20 bill without solar: 9000 x 1.05^19
    expect(p.rows[19].withoutSolar).toBeCloseTo(9000 * 1.05 ** 19, 6);
    expect(p.breakEvenYear).toBe(6);
  });
});
