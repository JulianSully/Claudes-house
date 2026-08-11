import { useMemo } from "react";

import { allocateAverageDay } from "./profiles.js";

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
 *   4. `productionFactor` (kWh/kW/day) drives production. It was originally
 *      fixed at 5 and hidden; it is now set from region + season and is
 *      editable, because 5 is optimistic as an annual average for most of
 *      Australia and a hidden constant that size is the biggest single
 *      unchecked lever in the estimate. See REGIONS below.
 *   5. The battery loses energy on the round trip. To deliver L kWh at night
 *      it must store L / efficiency, so the charge is sized on the delivered
 *      figure and the difference is a real loss, not free energy.
 *
 * On rule 3: the battery is topped up by the amount last night drew out of it,
 * NOT to its full capacity. It begins each day already holding whatever the
 * night did not consume, so a 16 kWh battery serving a 10 kWh night load takes
 * on 10 kWh and the rest of the spare solar is exported. Filling to capacity
 * instead would strand energy in the battery that is neither consumed nor sold
 * — on a 16 kWh battery against a 4.8 kWh night load that was roughly 1,000
 * kWh, about $61 of unclaimed feed-in, per quarter.
 *
 * Verified test case (see solarCalc.test.js — run `npm test` after ANY change
 * to this file): $281/month bill, $1.10/day supply, 32c/kWh usage, 6c/kWh
 * feed-in, 60/40 day-night split, 6.6 kW system, 16 kWh battery
 *   -> 775 kWh total (465 day / 310 night), day and night usage both fully
 *      covered, zero night usage left on the grid, 7.17 kWh/day exported.
 */

/**
 * Indicative annual-average yield in kWh per kW installed per day, with rough
 * summer and winter figures for the same location.
 *
 * These are PLANNING NUMBERS, not measurements. Published sources disagree by
 * a few tenths — CEC-derived zone ratings put Sydney anywhere from 3.9 to 4.2
 * — and real yield moves with orientation, tilt, shading and soiling. They are
 * deliberately editable in the UI. Calibrate them against your own fleet's
 * monitoring data as soon as you have enough installs to do so; that is worth
 * more than any published table.
 *
 * The seasonal spread matters more than the annual figure for quoting: a
 * customer sold on an annual average whose system is commissioned in May sees
 * their first bill against the winter number, not the average.
 */
export const REGIONS = {
  nt: { label: "Darwin / NT", annual: 5.0, summer: 4.8, winter: 5.3 },
  wa: { label: "Perth / WA", annual: 4.9, summer: 6.4, winter: 3.1 },
  qld: { label: "Brisbane / QLD", annual: 4.5, summer: 5.3, winter: 3.7 },
  sa: { label: "Adelaide / SA", annual: 4.4, summer: 6.1, winter: 2.6 },
  act: { label: "Canberra / ACT", annual: 4.2, summer: 5.6, winter: 2.7 },
  nsw: { label: "Sydney / NSW", annual: 4.1, summer: 5.1, winter: 3.0 },
  vic: { label: "Melbourne / VIC", annual: 3.8, summer: 5.3, winter: 2.1 },
  tas: { label: "Hobart / TAS", annual: 3.5, summer: 5.0, winter: 1.7 },
};

export const SEASONS = [
  { value: "annual", label: "Annual" },
  { value: "summer", label: "Summer" },
  { value: "winter", label: "Winter" },
];

export const DEFAULT_REGION = "nsw";
export const DEFAULT_SEASON = "annual";

export const productionFactorFor = (region, season) =>
  REGIONS[region]?.[season] ?? REGIONS[DEFAULT_REGION].annual;

/** Round-trip efficiency of a typical lithium home battery. */
export const DEFAULT_BATTERY_EFFICIENCY = 90; // %

/**
 * The original hardcoded factor, kept so the regression tests can pin the
 * allocation logic at a known value independent of the region table.
 */
export const LEGACY_PRODUCTION_FACTOR = 5.0;

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
  season = "annual", // sets the daylight window used for the overlap
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

  // Solar only offsets what it OVERLAPS. Daytime demand peaks at 7am and 5pm,
  // when the sun is low or gone, so an hour-by-hour overlap is the difference
  // between an honest estimate and one claiming the customer never buys power
  // again. The day is also run across a mix of clear, mixed and overcast
  // weather, because averaging the sun first hides the cloudy days on which the
  // house buys power and the battery never fills.
  //
  // The day/night slider still sets how much of the total lands in daylight
  // hours; the shapes only decide how it is spread within them.
  // See calc/profiles.js.
  const efficiency = Math.min(1, Math.max(0, NUMBER(batteryEfficiency) / 100));

  const day = allocateAverageDay({
    dailyUsage: dailyDayKwh + dailyNightKwh,
    dailyProduction,
    dayPercent,
    season,
    batteryKwh,
    efficiency,
  });

  const dailySelfConsumed = day.selfConsumed;
  const dailyExcess = day.excess;
  const dailyBatteryCharge = day.batteryCharge;
  const dailyExported = day.exported;
  const dailyBatteryLoss = day.batteryCharge - day.batteryDelivered;
  const dailyNightCovered = day.nightCovered;
  const dailyDayCoveredByBattery = day.dayCoveredByBattery;
  const dailyRemainingNight = day.remainingNight;
  const dailyRemainingDay = day.remainingDay;
  const daytimeShortfall = day.daytimeShortfall;
  const darkLoad = day.darkLoad;

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
  const dayCoveredByBattery = dailyDayCoveredByBattery * days;
  const savingsBattery = (nightCoveredByBattery + dayCoveredByBattery) * usageRate;
  const totalSavings = savingsSelfConsumed + savingsExport + savingsBattery;

  const newBill = Math.max(0, bill - totalSavings);
  const savingsPercent = bill > 0 ? (totalSavings / bill) * 100 : 0;

  return {
    totalKwh, dayKwh, nightKwh, systemProduction,
    usagePortion, effectiveRate, usageFromBill: !(NUMBER(knownUsageKwh) > 0),
    selfConsumed, exported, remainingDayUsage,
    batteryCharge, nightCoveredByBattery, dayCoveredByBattery,
    batteryLoss, remainingNightUsage, daytimeShortfall, darkLoad,
    savingsSelfConsumed, savingsExport, savingsBattery, totalSavings,
    newBill, savingsPercent,
    // Daily-average figures, exposed for display only. These are the same
    // numbers the period totals above are derived from — never recompute
    // them by dividing a period total by anything other than `days`.
    dailyProduction, dailySelfConsumed, dailyExported, dailyBatteryCharge,
    dailyNightCovered, dailyDayCoveredByBattery, dailyBatteryLoss,
    dailyRemainingDay, dailyRemainingNight,
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
    season = "annual",
  } = inputs;

  return useMemo(
    () =>
      computeResults({
        billAmount, knownUsageKwh, supplyCharge, usageCharge, feedInTariff,
        systemSizeKw, productionFactor, batteryCapacity, batteryEfficiency,
        season, dayPercent, nightPercent, days,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplyCharge, usageCharge, feedInTariff, billAmount, knownUsageKwh, billPeriod, dayPercent, systemSizeKw, productionFactor, batteryCapacity, batteryEfficiency, season, days, nightPercent]
  );
}

export const DAYS_IN_PERIOD = { monthly: 30, quarterly: 91 };
