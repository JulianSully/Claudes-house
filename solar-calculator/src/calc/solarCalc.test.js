import { describe, it, expect } from "vitest";
import {
  computeResults,
  computeEconomics,
  productionFactorFor,
  LEGACY_PRODUCTION_FACTOR,
  DEFAULT_BATTERY_EFFICIENCY,
  DEFAULT_REGION,
  REGIONS,
  DAYS_IN_PERIOD,
} from "./solarCalc";

// The regression suite pins the allocation at a lossless battery and the
// original 5 kWh/kW/day factor, so it tests the maths rather than whatever
// the region table or the efficiency default happen to say this week.
const TARIFF = {
  supplyCharge: 1.1, // $/day
  usageCharge: 32, // c/kWh
  feedInTariff: 6, // c/kWh
  systemSizeKw: 6.6,
  productionFactor: LEGACY_PRODUCTION_FACTOR,
  batteryCapacity: 16,
  batteryEfficiency: 100,
  dayPercent: 60,
  nightPercent: 40,
};

const run = (over = {}) => computeResults({ ...TARIFF, ...over });

/* ------------------------------------------------------------------ *
 * THE VERIFIED CASE
 *
 * The brief specifies: $1.10/day supply, 32c/kWh usage, 6c/kWh feed-in,
 * 60/40 day-night split, 6.6 kW system, 16 kWh battery, back-calculating to
 * 775 kWh total (465 day / 310 night), with day and night both fully covered,
 * ~1.5 kWh/day exported and zero night usage left on the grid.
 *
 * At those tariffs, 775 kWh over a 30-day month is the usage implied by a
 * $281 bill:  (281 − 1.10×30) ÷ 0.32 = 775.
 * The brief quotes the bill as $450; a $450 monthly bill at 32c/kWh
 * back-calculates to 1303.125 kWh, not 775 (see the test below it). Every
 * other number in the verified case lines up exactly at 775 kWh / 30 days,
 * so that is what this test pins.
 * ------------------------------------------------------------------ */
describe("verified case — 775 kWh over 30 days", () => {
  const r = run({ billAmount: 281, days: 30 });

  it("back-calculates 775 kWh total, split 465 day / 310 night", () => {
    expect(r.totalKwh).toBeCloseTo(775, 6);
    expect(r.dayKwh).toBeCloseTo(465, 6);
    expect(r.nightKwh).toBeCloseTo(310, 6);
  });

  it("covers most, but not all, of daylight demand", () => {
    // Not 465. The 7am and 4pm peaks land when the sun is low, and a quarter
    // of days are overcast, so 29 kWh of daytime demand is still bought.
    expect(r.selfConsumed).toBeCloseTo(416.09, 1);
    expect(r.remainingDayUsage).toBeCloseTo(29.15, 1);
    expect(r.remainingDayUsage).toBeGreaterThan(0);
  });

  it("covers most of the evening from the battery", () => {
    expect(r.nightCoveredByBattery).toBeCloseTo(260.51, 1);
    expect(r.dayCoveredByBattery).toBeCloseTo(19.76, 1);
    // On overcast days there is not enough spare solar to refill it.
    expect(r.remainingNightUsage).toBeCloseTo(49.49, 1);
  });

  it("exports the spare solar the battery does not need", () => {
    expect(r.dailyExported).toBeCloseTo(9.788, 2);
    expect(r.exported).toBeCloseTo(293.63, 1);
  });

  it("produces 33 kWh/day from the 6.6 kW system", () => {
    expect(r.dailyProduction).toBeCloseTo(33, 9);
    expect(r.systemProduction).toBeCloseTo(990, 6);
  });
});

/* The brief's literal inputs, pinned so any drift is visible. */
describe("brief's literal inputs — $450/month", () => {
  const r = run({ billAmount: 450, days: 30 });

  it("back-calculates 1303.125 kWh, not 775", () => {
    expect(r.totalKwh).toBeCloseTo(1303.125, 6);
    expect(r.dayKwh).toBeCloseTo(781.875, 6);
    expect(r.nightKwh).toBeCloseTo(521.25, 6);
  });

  it("leaves a large shortfall day and night on a heavy user", () => {
    // 43 kWh/day of demand against 33 kWh/day of production: the panels
    // cannot cover the day, and what little is spare cannot cover the night.
    expect(r.remainingDayUsage).toBeCloseTo(173.28, 1);
    expect(r.dailyBatteryCharge).toBeCloseTo(10.792, 2);
    expect(r.remainingNightUsage).toBeCloseTo(197.49, 1);
  });
});

/* ------------------------------------------------------------------ *
 * RULE GUARDS — these are the invariants the brief locks down.
 * ------------------------------------------------------------------ */
describe("rule 1 — production is per day, not per period", () => {
  it("daily production ignores the period length", () => {
    const monthly = run({ billAmount: 281, days: 30 });
    const quarterly = run({ billAmount: 852.37, days: 91 });
    expect(monthly.dailyProduction).toBeCloseTo(33, 9);
    expect(quarterly.dailyProduction).toBeCloseTo(33, 9);
  });

  it("period production is daily production × days", () => {
    for (const days of [30, 91]) {
      const r = run({ billAmount: 281, days });
      expect(r.systemProduction).toBeCloseTo(r.dailyProduction * days, 9);
    }
  });
});

describe("rule 2 — the battery is a DAILY cap, not a per-period one", () => {
  it("never charges more than its capacity in a single day", () => {
    for (const days of Object.values(DAYS_IN_PERIOD)) {
      const r = run({ billAmount: 2000, days, batteryCapacity: 16 });
      expect(r.dailyBatteryCharge).toBeLessThanOrEqual(16 + 1e-9);
      // …but it does charge on every day of the period.
      expect(r.batteryCharge).toBeCloseTo(r.dailyBatteryCharge * days, 9);
    }
  });

  it("gives identical daily figures for a month and a quarter of the same usage", () => {
    // Two bills describing exactly the same daily consumption (25.833 kWh/day).
    const dailyKwh = 775 / 30;
    const billFor = (days) => 1.1 * days + dailyKwh * days * 0.32;

    const monthly = run({ billAmount: billFor(30), days: 30 });
    const quarterly = run({ billAmount: billFor(91), days: 91 });

    for (const key of [
      "dailyProduction",
      "dailyDayKwh",
      "dailyNightKwh",
      "dailySelfConsumed",
      "dailyBatteryCharge",
      "dailyExported",
      "dailyNightCovered",
      "dailyRemainingDay",
      "dailyRemainingNight",
    ]) {
      expect(quarterly[key], key).toBeCloseTo(monthly[key], 9);
    }

    // A longer period is worth proportionally more, nothing more.
    expect(quarterly.totalSavings).toBeCloseTo((monthly.totalSavings / 30) * 91, 6);
  });
});

describe("rule 3 — allocation priority", () => {
  it("solar covers day usage before anything charges the battery", () => {
    // Day usage exceeds production: no charge, no export, day shortfall left.
    const r = run({ billAmount: 900, days: 30, dayPercent: 100, nightPercent: 0 });
    expect(r.dailySelfConsumed).toBeCloseTo(33, 9);
    expect(r.dailyBatteryCharge).toBeCloseTo(0, 9);
    expect(r.dailyExported).toBeCloseTo(0, 9);
    expect(r.remainingDayUsage).toBeGreaterThan(0);
  });

  it("tops the battery up by what will be drawn out, not to full capacity", () => {
    // The battery starts the day already holding what last night didn't use,
    // so extra capacity beyond the load it serves changes nothing: 16 kWh and
    // 20 kWh give the identical answer.
    const at16 = run({ billAmount: 281, days: 30, batteryCapacity: 16 });
    const at20 = run({ billAmount: 281, days: 30, batteryCapacity: 20 });
    expect(at20.dailyBatteryCharge).toBeCloseTo(at16.dailyBatteryCharge, 9);
    expect(at20.dailyBatteryCharge).toBeCloseTo(9.3425, 3);
    expect(at20.dailyExported).toBeCloseTo(9.7878, 3);
  });

  it("strands nothing — everything stored is drawn back out the same day", () => {
    for (const batteryCapacity of [0, 4, 5, 16, 27, 40]) {
      for (const billAmount of [120, 281, 450, 900]) {
        for (const days of [30, 91]) {
          const r = run({ billAmount, days, batteryCapacity });
          // At 100% efficiency, what goes in comes back out — split between
          // the evening load and the dawn shortfall the panels missed.
          expect(
            r.nightCoveredByBattery + r.dayCoveredByBattery,
            `${batteryCapacity}kWh/$${billAmount}/${days}d`
          ).toBeCloseTo(r.batteryCharge, 6);
        }
      }
    }
  });

  it("still respects capacity when the load exceeds it", () => {
    // A 4 kWh battery cannot take more than 4 kWh on any day, and the evening
    // it cannot reach is bought from the grid.
    const r = run({ billAmount: 281, days: 30, batteryCapacity: 4 });
    expect(r.dailyBatteryCharge).toBeLessThanOrEqual(4 + 1e-9);
    expect(r.dailyBatteryCharge).toBeCloseTo(3.9338, 3);
    expect(r.dailyRemainingNight).toBeCloseTo(6.3995, 3);
  });

  it("a bigger battery never charges less, or exports more", () => {
    let previousCharge = -1;
    let previousExport = Infinity;
    for (const batteryCapacity of [0, 2, 4, 8, 16, 30]) {
      const r = run({ billAmount: 281, days: 30, batteryCapacity });
      expect(r.dailyBatteryCharge, `${batteryCapacity}kWh`).toBeGreaterThanOrEqual(
        previousCharge - 1e-9
      );
      expect(r.dailyExported, `${batteryCapacity}kWh`).toBeLessThanOrEqual(
        previousExport + 1e-9
      );
      previousCharge = r.dailyBatteryCharge;
      previousExport = r.dailyExported;
    }
  });

  it("energy balances: production = self-consumed + stored + exported", () => {
    for (const battery of [0, 5, 16, 40]) {
      for (const bill of [120, 281, 450, 900]) {
        const r = run({ billAmount: bill, days: 30, batteryCapacity: battery });
        expect(
          r.dailySelfConsumed + r.dailyBatteryCharge + r.dailyExported
        ).toBeCloseTo(r.dailyProduction, 9);
      }
    }
  });

  it("night usage draws only on what the battery actually stored", () => {
    const r = run({ billAmount: 281, days: 30, batteryCapacity: 4 });
    expect(r.dailyNightCovered).toBeLessThanOrEqual(r.dailyBatteryCharge + 1e-9);
    expect(r.dailyRemainingNight).toBeGreaterThan(0);
  });
});

describe("rule 4 — production factor comes from region + season", () => {
  it("keeps the legacy constant available for regression pinning", () => {
    expect(LEGACY_PRODUCTION_FACTOR).toBe(5);
  });

  it("resolves every region and season to a sane yield", () => {
    for (const [key, region] of Object.entries(REGIONS)) {
      for (const season of ["annual", "summer", "winter"]) {
        const f = productionFactorFor(key, season);
        expect(f, `${key}/${season}`).toBeGreaterThan(1);
        expect(f, `${key}/${season}`).toBeLessThan(7);
      }
      // Winter never beats summer outside the tropics; the NT is the one
      // place the dry season outperforms the wet.
      if (key !== "nt") {
        expect(region.winter, key).toBeLessThan(region.summer);
      }
      // The annual average has to sit between the two seasonal extremes,
      // whichever way round they fall.
      expect(region.annual, key).toBeGreaterThanOrEqual(
        Math.min(region.summer, region.winter)
      );
      expect(region.annual, key).toBeLessThanOrEqual(
        Math.max(region.summer, region.winter)
      );
    }
  });

  it("falls back to the default region for an unknown one", () => {
    expect(productionFactorFor("atlantis", "annual")).toBe(
      REGIONS[DEFAULT_REGION].annual
    );
  });

  it("scales production linearly with the factor", () => {
    const at = (productionFactor) =>
      run({ billAmount: 281, days: 30, productionFactor }).systemProduction;
    expect(at(4.1)).toBeCloseTo(at(8.2) / 2, 6);
  });
});

describe("rule 5 — battery round-trip losses", () => {
  it("loses nothing at 100%", () => {
    const r = run({ billAmount: 281, days: 30, batteryEfficiency: 100 });
    expect(r.batteryLoss).toBeCloseTo(0, 9);
    expect(r.dailyNightCovered + r.dailyDayCoveredByBattery).toBeCloseTo(
      r.dailyBatteryCharge,
      6
    );
  });

  it("stores more than it delivers, and the gap is the loss", () => {
    const r = run({ billAmount: 281, days: 30, batteryEfficiency: 90 });
    const delivered = r.dailyNightCovered + r.dailyDayCoveredByBattery;
    expect(delivered).toBeCloseTo(r.dailyBatteryCharge * 0.9, 6);
    expect(r.dailyBatteryLoss).toBeCloseTo(r.dailyBatteryCharge * 0.1, 6);
    expect(r.dailyBatteryCharge).toBeCloseTo(10.2768, 3);
  });

  it("still balances: production = self + charged + exported", () => {
    for (const batteryEfficiency of [0, 50, 85, 90, 100]) {
      for (const batteryCapacity of [0, 5, 16, 40]) {
        const r = run({ billAmount: 281, days: 30, batteryCapacity, batteryEfficiency });
        expect(
          r.dailySelfConsumed + r.dailyBatteryCharge + r.dailyExported,
          `${batteryEfficiency}%/${batteryCapacity}kWh`
        ).toBeCloseTo(r.dailyProduction, 9);
        expect(r.dailyNightCovered).toBeLessThanOrEqual(r.dailyBatteryCharge + 1e-9);
      }
    }
  });

  it("a 0% battery is worth nothing and stores nothing", () => {
    const r = run({ billAmount: 281, days: 30, batteryEfficiency: 0 });
    expect(r.dailyBatteryCharge).toBe(0);
    expect(r.savingsBattery).toBe(0);
    // All the spare solar is exported, exactly as with no battery at all.
    const none = run({ billAmount: 281, days: 30, batteryCapacity: 0 });
    expect(r.dailyExported).toBeCloseTo(none.dailyExported, 9);
  });

  it("losses cost the customer real money", () => {
    const lossless = run({ billAmount: 281, days: 30, batteryEfficiency: 100 });
    const real = run({ billAmount: 281, days: 30, batteryEfficiency: DEFAULT_BATTERY_EFFICIENCY });
    // A lossy battery has to draw more solar to deliver the same evening, so
    // less is left to export — and it delivers less besides.
    expect(real.batteryLoss).toBeGreaterThan(0);
    expect(real.exported).toBeLessThan(lossless.exported);
    expect(real.totalSavings).toBeLessThan(lossless.totalSavings);
  });
});

describe("economics", () => {
  const energy = run({ billAmount: 281, days: 30 });

  it("annualises the saving from the period length", () => {
    const e = computeEconomics({ totalSavings: energy.totalSavings, days: 30, systemCost: 0 });
    expect(e.annualSavings).toBeCloseTo((energy.totalSavings / 30) * 365, 6);
  });

  it("gives the same annual figure whichever period it is quoted over", () => {
    const monthly = computeEconomics({ totalSavings: 100, days: 30, systemCost: 9000 });
    const quarterly = computeEconomics({ totalSavings: (100 / 30) * 91, days: 91, systemCost: 9000 });
    expect(quarterly.annualSavings).toBeCloseTo(monthly.annualSavings, 6);
    expect(quarterly.paybackYears).toBeCloseTo(monthly.paybackYears, 6);
  });

  it("computes payback and ten-year net", () => {
    const e = computeEconomics({ totalSavings: 250, days: 30, systemCost: 12000 });
    const annual = (250 / 30) * 365;
    expect(e.paybackYears).toBeCloseTo(12000 / annual, 6);
    expect(e.tenYearNet).toBeCloseTo(annual * 10 - 12000, 6);
  });

  it("has no payback without a cost or without a saving", () => {
    expect(computeEconomics({ totalSavings: 250, days: 30, systemCost: 0 }).paybackYears).toBeNull();
    expect(computeEconomics({ totalSavings: 0, days: 30, systemCost: 9000 }).paybackYears).toBeNull();
    expect(computeEconomics({ totalSavings: 250, days: 0, systemCost: 9000 }).paybackYears).toBeNull();
  });
});

describe("edge cases", () => {
  it("returns zeroes rather than NaN for empty inputs", () => {
    const r = computeResults({
      billAmount: "", supplyCharge: "", usageCharge: "", feedInTariff: "",
      systemSizeKw: "", productionFactor: "", batteryCapacity: "",
      dayPercent: 60, nightPercent: 40, days: 30,
    });
    // Every numeric output must be a real number — no NaN leaking into the
    // UI. `usageFromBill` is a flag, not a figure, so it is exempt.
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === "boolean") continue;
      expect(Number.isFinite(value), key).toBe(true);
    }
    expect(r.totalKwh).toBe(0);
    expect(r.totalSavings).toBe(0);
  });

  it("never bills below zero when savings exceed the bill", () => {
    const r = run({ billAmount: 60, days: 30, systemSizeKw: 20 });
    expect(r.newBill).toBe(0);
  });

  it("no battery means no night saving — all of it stays on the grid", () => {
    const r = run({ billAmount: 281, days: 30, batteryCapacity: 0 });
    expect(r.savingsBattery).toBe(0);
    expect(r.remainingNightUsage).toBeCloseTo(310, 6);
    expect(r.dailyExported).toBeCloseTo(19.1303, 3);
  });
});

/* ------------------------------------------------------------------ *
 * Reading the usage off the bill instead of working it back.
 *
 * Working it back assumes one flat rate for every kWh. Controlled-load hot
 * water, an off-peak block, a tiered rate or a pay-on-time discount all put
 * the customer's real average below the headline rate — and dividing by the
 * headline rate then UNDERSTATES how much power they use. Reading the printed
 * kWh off the bill removes the whole class of error.
 * ------------------------------------------------------------------ */
describe("usage stated from the bill", () => {
  it("uses the stated figure instead of back-calculating", () => {
    const r = run({ billAmount: 200, supplyCharge: 1.7, days: 30, knownUsageKwh: 600 });
    expect(r.totalKwh).toBe(600);
    expect(r.dayKwh).toBeCloseTo(360, 9);
    expect(r.nightKwh).toBeCloseTo(240, 9);
    expect(r.usageFromBill).toBe(false);
  });

  it("reports what the customer really pays per kWh", () => {
    // $200 bill, $51 of supply, 600 kWh actually used → 24.8c, not the 32c
    // on the tariff sheet. That gap is the tell.
    const r = run({ billAmount: 200, supplyCharge: 1.7, days: 30, knownUsageKwh: 600 });
    expect(r.usagePortion).toBeCloseTo(149, 9);
    expect(r.effectiveRate * 100).toBeCloseTo(24.833, 3);
  });

  it("falls back to back-calculating when no figure is given", () => {
    const stated = run({ billAmount: 200, supplyCharge: 1.7, days: 30, knownUsageKwh: 0 });
    const implied = run({ billAmount: 200, supplyCharge: 1.7, days: 30 });
    expect(stated.totalKwh).toBeCloseTo(149 / 0.32, 6);
    expect(implied.totalKwh).toBeCloseTo(stated.totalKwh, 9);
    expect(implied.usageFromBill).toBe(true);
  });

  it("back-calculation understates usage whenever the real rate is lower", () => {
    const args = { billAmount: 200, supplyCharge: 1.7, days: 30 };
    const backCalculated = run(args).totalKwh; // assumes all 600 kWh at 32c
    const actual = run({ ...args, knownUsageKwh: 600 }).totalKwh;
    expect(backCalculated).toBeLessThan(actual);
    expect(backCalculated).toBeCloseTo(465.625, 3);
  });

  it("a stated figure ignores the tariff entirely", () => {
    for (const usageCharge of [20, 32, 55]) {
      expect(run({ billAmount: 200, days: 30, usageCharge, knownUsageKwh: 600 }).totalKwh).toBe(600);
    }
  });

  it("negative or junk stated usage falls back rather than breaking", () => {
    for (const knownUsageKwh of [-100, "", NaN, undefined]) {
      const r = run({ billAmount: 281, days: 30, knownUsageKwh });
      expect(r.totalKwh, String(knownUsageKwh)).toBeCloseTo(775, 6);
    }
  });
});
