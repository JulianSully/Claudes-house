import { describe, it, expect } from "vitest";
import { computeResults, PRODUCTION_FACTOR, DAYS_IN_PERIOD } from "./solarCalc";

const TARIFF = {
  supplyCharge: 1.1, // $/day
  usageCharge: 32, // c/kWh
  feedInTariff: 6, // c/kWh
  systemSizeKw: 6.6,
  productionFactor: PRODUCTION_FACTOR,
  batteryCapacity: 16,
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

  it("covers day usage in full", () => {
    expect(r.remainingDayUsage).toBeCloseTo(0, 9);
    expect(r.selfConsumed).toBeCloseTo(465, 6);
  });

  it("covers night usage in full — nothing left on the grid", () => {
    expect(r.remainingNightUsage).toBeCloseTo(0, 9);
    expect(r.nightCoveredByBattery).toBeCloseTo(310, 6);
  });

  it("exports the spare solar the battery does not need", () => {
    // 33 produced − 15.5 day − 10.333 battery top-up = 7.167 exported.
    expect(r.dailyExported).toBeCloseTo(7.166666666, 6);
    expect(r.exported).toBeCloseTo(215, 6);
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

  it("covers day usage but leaves night usage on the grid", () => {
    expect(r.remainingDayUsage).toBeCloseTo(0, 9);
    // 26.06 kWh/day of day usage leaves only 6.94 kWh to charge a 16 kWh
    // battery, so nothing is exported and the battery cannot cover the night.
    expect(r.dailyBatteryCharge).toBeCloseTo(6.9375, 9);
    expect(r.exported).toBeCloseTo(0, 9);
    expect(r.remainingNightUsage).toBeCloseTo(313.125, 6);
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

  it("tops the battery up by the night load, not to full capacity", () => {
    // The battery starts the day already holding what last night didn't use,
    // so it only takes back the 10.333 kWh the night drew out — even with
    // 17.5 kWh/day spare and 20 kWh of capacity available.
    const r = run({ billAmount: 281, days: 30, batteryCapacity: 20 });
    expect(r.dailyBatteryCharge).toBeCloseTo(310 / 30, 9);
    expect(r.dailyExported).toBeCloseTo(17.5 - 310 / 30, 9);
  });

  it("strands nothing — everything stored is drawn back out that night", () => {
    for (const batteryCapacity of [0, 4, 5, 16, 27, 40]) {
      for (const billAmount of [120, 281, 450, 900]) {
        for (const days of [30, 91]) {
          const r = run({ billAmount, days, batteryCapacity });
          expect(r.nightCoveredByBattery, `${batteryCapacity}kWh/$${billAmount}`)
            .toBeCloseTo(r.batteryCharge, 9);
        }
      }
    }
  });

  it("still respects capacity when the night load exceeds it", () => {
    // 4 kWh battery against a 10.333 kWh night: capacity is the binding cap.
    const r = run({ billAmount: 281, days: 30, batteryCapacity: 4 });
    expect(r.dailyBatteryCharge).toBeCloseTo(4, 9);
    expect(r.dailyRemainingNight).toBeCloseTo(310 / 30 - 4, 9);
  });

  it("still respects available solar when that is the binding cap", () => {
    // 26.06 kWh/day of day usage leaves only 6.9375 spare for a 16 kWh
    // battery facing a 17.375 kWh night — the spare solar is the limit.
    const r = run({ billAmount: 450, days: 30, batteryCapacity: 16 });
    expect(r.dailyBatteryCharge).toBeCloseTo(6.9375, 9);
    expect(r.dailyExported).toBeCloseTo(0, 9);
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
    expect(r.dailyNightCovered).toBeCloseTo(4, 9);
    expect(r.dailyRemainingNight).toBeCloseTo(310 / 30 - 4, 9);
  });
});

describe("rule 4 — production factor is fixed at 5 kWh/kW/day", () => {
  it("is 5", () => {
    expect(PRODUCTION_FACTOR).toBe(5);
  });
});

describe("edge cases", () => {
  it("returns zeroes rather than NaN for empty inputs", () => {
    const r = computeResults({
      billAmount: "", supplyCharge: "", usageCharge: "", feedInTariff: "",
      systemSizeKw: "", productionFactor: "", batteryCapacity: "",
      dayPercent: 60, nightPercent: 40, days: 30,
    });
    for (const [key, value] of Object.entries(r)) {
      expect(Number.isFinite(value), key).toBe(true);
    }
    expect(r.totalKwh).toBe(0);
    expect(r.totalSavings).toBe(0);
  });

  it("never bills below zero when savings exceed the bill", () => {
    const r = run({ billAmount: 60, days: 30, systemSizeKw: 20 });
    expect(r.newBill).toBe(0);
  });

  it("no battery means no night saving", () => {
    const r = run({ billAmount: 281, days: 30, batteryCapacity: 0 });
    expect(r.savingsBattery).toBe(0);
    expect(r.remainingNightUsage).toBeCloseTo(310, 6);
    expect(r.dailyExported).toBeCloseTo(17.5, 9);
  });
});
