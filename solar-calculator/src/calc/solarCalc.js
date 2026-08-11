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
 *   3. Priority: solar -> day usage (self-consumption) -> battery (takes the
 *      top-up it needs) -> export (everything else). Then separately:
 *      battery -> night usage -> grid (whatever the battery cannot cover).
 *   4. Production is a flat `SUN_HOURS_PER_DAY` of output — 5 hours, so a
 *      6.6 kW system makes about 33 kWh a day. One number, editable, no
 *      seasonal or hourly modelling: a quoting tool the rep can explain to a
 *      customer in one sentence beats a more elaborate one they cannot.
 *   5. The battery loses energy on the round trip. To deliver L kWh at night
 *      it must store L / efficiency, so the charge is sized on the delivered
 *      figure and the difference is a real loss, not free energy.
 *
 * Verified test case (see solarCalc.test.js — run `npm test` after ANY change
 * to this file): $281/month bill, $1.10/day supply, 32c/kWh usage, 6c/kWh
 * feed-in, 60/40 day-night split, 6.6 kW system, 16 kWh battery
 *   -> 775 kWh total (465 day / 310 night), day and night usage both fully
 *      covered, zero night usage left on the grid, 7.17 kWh/day exported.
 */

/**
 * Peak sun hours per day — the flat average this tool runs on.
 *
 * Multiply by system size for daily output: 6.6 kW x 5 = 33 kWh a day. It is a
 * rule of thumb, not a yield model, and that is the point. It is editable in
 * the UI so a rep who knows their patch can set it to whatever their own
 * installs actually do.
 */
export const SUN_HOURS_PER_DAY = 5;

/** Round-trip efficiency of a typical lithium home battery. */
export const DEFAULT_BATTERY_EFFICIENCY = 90; // %

export const NUMBER = (v) => (Number.isFinite(v) ? v : 0);

export function computeResults({
  billAmount,
  knownUsageKwh, // kWh straight off the bill; wins over the back-calculation
  supplyCharge,
  usageCharge,
  feedInTariff,
  systemSizeKw,
  productionFactor,
  batteryCapacity,
  batteryEfficiency = 100, // %, round trip
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

  // Two ways to know how much power the house uses:
  //
  //   1. READ IT OFF THE BILL. Every Australian bill prints the kWh. When the
  //      rep has that number, use it — it is a measurement.
  //   2. WORK IT BACK from the dollar amount. Only as good as the assumption
  //      that every kWh was billed at one flat rate, which is wrong the moment
  //      there is controlled-load hot water, an off-peak block, a tiered rate
  //      or a pay-on-time discount on the account. Each of those means the
  //      customer's average rate is below the headline one, and dividing by
  //      the headline rate then UNDERSTATES how much power they actually use.
  //
  // Path 2 is the fallback, not the default, for exactly that reason.
  const stated = NUMBER(knownUsageKwh);
  const backCalculated = usageRate > 0 ? usagePortion / usageRate : 0;
  const totalKwh = stated > 0 ? stated : backCalculated;

  // What the customer is actually paying per kWh once the supply charge is
  // taken out. When this sits well below the headline rate, something on the
  // account is cheaper than the tariff sheet says — worth the rep noticing.
  const effectiveRate = totalKwh > 0 ? usagePortion / totalKwh : 0;

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

  // The battery starts the day part-full: it only lost whatever last night
  // drew out of it. So the top-up it needs is the night load, not its whole
  // capacity — a 16 kWh battery covering 10 kWh of night usage takes 10 kWh
  // back and the remaining 6 kWh is still sitting there. Capped three ways:
  // by the solar actually spare, by capacity, and by the night load.
  //
  // Round-trip losses inflate that top-up: delivering L kWh after dark means
  // storing L / efficiency, so the charge is sized on the delivered figure.
  const efficiency = Math.min(1, Math.max(0, NUMBER(batteryEfficiency) / 100));
  const chargeNeededForNight = efficiency > 0 ? dailyNightKwh / efficiency : 0;
  const dailyBatteryCharge = Math.min(dailyExcess, batteryKwh, chargeNeededForNight);

  // Everything past that top-up is sold rather than sitting in a full battery
  // earning nothing.
  const dailyExported = dailyExcess - dailyBatteryCharge;

  // What comes back out is what went in, less the round-trip loss.
  const dailyNightCovered = dailyBatteryCharge * efficiency;
  const dailyBatteryLoss = dailyBatteryCharge - dailyNightCovered;
  const dailyRemainingNight = Math.max(0, dailyNightKwh - dailyNightCovered);

  // Scale daily figures back up to the full billing period
  const systemProduction = dailyProduction * days;
  const selfConsumed = dailySelfConsumed * days;
  const exported = dailyExported * days;
  const remainingDayUsage = dailyRemainingDay * days;
  const batteryCharge = dailyBatteryCharge * days;
  const nightCoveredByBattery = dailyNightCovered * days;
  const batteryLoss = dailyBatteryLoss * days;
  const remainingNightUsage = dailyRemainingNight * days;

  const savingsSelfConsumed = selfConsumed * usageRate;
  const savingsExport = exported * fit;
  const savingsBattery = nightCoveredByBattery * usageRate;
  const totalSavings = savingsSelfConsumed + savingsExport + savingsBattery;

  const newBill = Math.max(0, bill - totalSavings);
  const savingsPercent = bill > 0 ? (totalSavings / bill) * 100 : 0;

  return {
    totalKwh, dayKwh, nightKwh, systemProduction,
    usagePortion, effectiveRate, usageFromBill: !(NUMBER(knownUsageKwh) > 0),
    selfConsumed, exported, remainingDayUsage,
    batteryCharge, nightCoveredByBattery, batteryLoss, remainingNightUsage,
    savingsSelfConsumed, savingsExport, savingsBattery, totalSavings,
    newBill, savingsPercent,
    // Daily-average figures, exposed for display only. These are the same
    // numbers the period totals above are derived from — never recompute
    // them by dividing a period total by anything other than `days`.
    dailyProduction, dailySelfConsumed, dailyExported, dailyBatteryCharge,
    dailyNightCovered, dailyBatteryLoss, dailyRemainingDay, dailyRemainingNight,
    dailyDayKwh, dailyNightKwh,
  };
}

/**
 * Economics derived from the energy result. Deliberately separate from
 * `computeResults` — it consumes the saving, it never feeds back into how
 * energy is allocated.
 *
 * Simple payback only: no tariff inflation, no panel degradation, no discount
 * rate, no STC handling (assume `systemCost` is the net price the customer
 * actually pays). Those all move the answer, and a quoting tool that pretends
 * otherwise is worse than one that states the assumption.
 */
export function computeEconomics({ totalSavings, days, systemCost }) {
  const cost = NUMBER(systemCost);
  const perPeriod = NUMBER(totalSavings);
  const annualSavings = days > 0 ? (perPeriod / days) * 365 : 0;

  const paybackYears = cost > 0 && annualSavings > 0 ? cost / annualSavings : null;
  const tenYearNet = annualSavings * 10 - cost;

  return { annualSavings, paybackYears, tenYearNet, systemCost: cost };
}

/**
 * React binding for `computeResults`. Memo deps mirror the original
 * component's dependency array exactly.
 */
export function useSolarResults(inputs) {
  const {
    supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod,
    dayPercent, systemSizeKw, productionFactor, batteryCapacity,
    batteryEfficiency = 100, days, nightPercent, knownUsageKwh,
  } = inputs;

  return useMemo(
    () =>
      computeResults({
        billAmount, knownUsageKwh, supplyCharge, usageCharge, feedInTariff,
        systemSizeKw, productionFactor, batteryCapacity, batteryEfficiency,
        dayPercent, nightPercent, days,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplyCharge, usageCharge, feedInTariff, billAmount, knownUsageKwh, billPeriod, dayPercent, systemSizeKw, productionFactor, batteryCapacity, batteryEfficiency, days, nightPercent]
  );
}

export const DAYS_IN_PERIOD = { monthly: 30, quarterly: 91 };
