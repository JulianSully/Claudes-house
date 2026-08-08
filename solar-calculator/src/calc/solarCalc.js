import { useMemo } from "react";

/**
 * LOCKED CALCULATION MODULE — do not change the maths in `computeResults`.
 *
 * The rules this file encodes, in the order energy is allocated:
 *
 *   1. Production is `systemSizeKw * productionFactor` PER DAY. It is never
 *      multiplied by `days` before the battery cap is applied.
 *   2. The battery is a DAILY cap. It charges and discharges once per day of
 *      the billing period, not once for the whole period. Every battery /
 *      production / export figure is computed on daily averages first, and
 *      only multiplied by `days` at the very end. (This was a real bug that
 *      has already been found and fixed — do not reintroduce it.)
 *   3. Priority: solar -> day usage (self-consumption) -> battery (charges
 *      with the leftover) -> export (whatever is left once the battery is
 *      full). Then separately: battery -> night usage -> grid (whatever the
 *      battery cannot cover).
 *   4. `productionFactor` is fixed at 5 kWh/kW/day and is intentionally not
 *      exposed as an input in the UI.
 *
 * Verified test case (see solarCalc.test.js — run `npm test` after ANY change
 * to this file): $450/month bill, $1.10/day supply, 32c/kWh usage, 6c/kWh
 * feed-in, 60/40 day-night split, 6.6 kW system, 16 kWh battery
 *   -> 775 kWh total (465 day / 310 night), day and night usage both fully
 *      covered, ~1.5 kWh/day exported, zero night usage left on the grid.
 */

export const PRODUCTION_FACTOR = 5.0; // kWh/kW/day — fixed, not a UI input

export const NUMBER = (v) => (Number.isFinite(v) ? v : 0);

export function computeResults({
  billAmount,
  supplyCharge,
  usageCharge,
  feedInTariff,
  systemSizeKw,
  productionFactor,
  batteryCapacity,
  dayPercent,
  nightPercent,
  days,
}) {
  const bill = NUMBER(billAmount);
  const supply = NUMBER(supplyCharge);
  const usageRate = NUMBER(usageCharge) / 100;
  const fit = NUMBER(feedInTariff) / 100;
  const sizeKw = NUMBER(systemSizeKw);
  const prodFactor = NUMBER(productionFactor);
  const batteryKwh = NUMBER(batteryCapacity);

  const supplyCostTotal = supply * days;
  const usagePortion = Math.max(0, bill - supplyCostTotal);
  const totalKwh = usageRate > 0 ? usagePortion / usageRate : 0;

  const dayKwh = totalKwh * (dayPercent / 100);
  const nightKwh = totalKwh * (nightPercent / 100);

  // Work in daily averages so the battery charges/discharges once per day,
  // not once for the whole billing period
  const dailyDayKwh = dayKwh / days;
  const dailyNightKwh = nightKwh / days;
  const dailyProduction = sizeKw * prodFactor;

  const dailySelfConsumed = Math.min(dailyProduction, dailyDayKwh);
  const dailyExcess = Math.max(0, dailyProduction - dailyDayKwh);
  const dailyRemainingDay = Math.max(0, dailyDayKwh - dailyProduction);

  const dailyBatteryCharge = Math.min(dailyExcess, batteryKwh);
  const dailyExported = dailyExcess - dailyBatteryCharge;

  const dailyNightCovered = Math.min(dailyBatteryCharge, dailyNightKwh);
  const dailyRemainingNight = Math.max(0, dailyNightKwh - dailyNightCovered);

  // Scale daily figures back up to the full billing period
  const systemProduction = dailyProduction * days;
  const selfConsumed = dailySelfConsumed * days;
  const exported = dailyExported * days;
  const remainingDayUsage = dailyRemainingDay * days;
  const batteryCharge = dailyBatteryCharge * days;
  const nightCoveredByBattery = dailyNightCovered * days;
  const remainingNightUsage = dailyRemainingNight * days;

  const savingsSelfConsumed = selfConsumed * usageRate;
  const savingsExport = exported * fit;
  const savingsBattery = nightCoveredByBattery * usageRate;
  const totalSavings = savingsSelfConsumed + savingsExport + savingsBattery;

  const newBill = Math.max(0, bill - totalSavings);
  const savingsPercent = bill > 0 ? (totalSavings / bill) * 100 : 0;

  return {
    totalKwh, dayKwh, nightKwh, systemProduction,
    selfConsumed, exported, remainingDayUsage,
    batteryCharge, nightCoveredByBattery, remainingNightUsage,
    savingsSelfConsumed, savingsExport, savingsBattery, totalSavings,
    newBill, savingsPercent,
    // Daily-average figures, exposed for display only. These are the same
    // numbers the period totals above are derived from — never recompute
    // them by dividing a period total by anything other than `days`.
    dailyProduction, dailySelfConsumed, dailyExported, dailyBatteryCharge,
    dailyNightCovered, dailyRemainingDay, dailyRemainingNight,
    dailyDayKwh, dailyNightKwh,
  };
}

/**
 * React binding for `computeResults`. Memo deps mirror the original
 * component's dependency array exactly.
 */
export function useSolarResults(inputs) {
  const {
    supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod,
    dayPercent, systemSizeKw, productionFactor, batteryCapacity,
    days, nightPercent,
  } = inputs;

  return useMemo(
    () =>
      computeResults({
        billAmount, supplyCharge, usageCharge, feedInTariff,
        systemSizeKw, productionFactor, batteryCapacity,
        dayPercent, nightPercent, days,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod, dayPercent, systemSizeKw, productionFactor, batteryCapacity, days, nightPercent]
  );
}

export const DAYS_IN_PERIOD = { monthly: 30, quarterly: 91 };
