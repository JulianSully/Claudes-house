import { useMemo, useState } from "react";

import {
  useSolarResults,
  computeEconomics,
  productionFactorFor,
  DAYS_IN_PERIOD,
  DEFAULT_REGION,
  DEFAULT_SEASON,
  DEFAULT_BATTERY_EFFICIENCY,
  REGIONS,
} from "../calc/solarCalc";

/**
 * One quote's worth of state, shared by the rep's input screen and the
 * customer-facing screens so both always show the same numbers.
 *
 * Nothing in here computes energy — that all lives in calc/solarCalc.js. This
 * hook holds inputs, wires them to the calculation, and derives the handful of
 * presentation-only figures both screens need.
 */
export function useQuote() {
  // Site
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [siteImage, setSiteImage] = useState(null); // { src, kind: "upload" | "satellite" }

  // Tariff
  const [supplyCharge, setSupplyCharge] = useState(1.1); // $/day
  const [usageCharge, setUsageCharge] = useState(32); // c/kWh
  const [feedInTariff, setFeedInTariff] = useState(6); // c/kWh

  // Current bill
  const [billAmount, setBillAmount] = useState(450);
  const [billPeriod, setBillPeriod] = useState("quarterly"); // monthly | quarterly
  const [dayPercent, setDayPercent] = useState(60);

  // Proposed system
  const [systemSizeKw, setSystemSizeKw] = useState(6.6);
  const [batteryCapacity, setBatteryCapacity] = useState(0); // kWh, 0 = solar only
  const [batteryEfficiency, setBatteryEfficiency] = useState(DEFAULT_BATTERY_EFFICIENCY);
  const [systemCost, setSystemCost] = useState(6500); // $ net of STCs

  // Yield
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [factorOverride, setFactorOverride] = useState(null);

  const suggestedFactor = productionFactorFor(region, season);
  const productionFactor = factorOverride ?? suggestedFactor;
  const factorIsOverridden =
    factorOverride !== null && Math.abs(factorOverride - suggestedFactor) > 1e-9;

  const days = DAYS_IN_PERIOD[billPeriod];
  const nightPercent = 100 - dayPercent;
  const periodWord = billPeriod === "monthly" ? "month" : "quarter";
  const periodShort = billPeriod === "monthly" ? "mo" : "qtr";

  const results = useSolarResults({
    supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod,
    dayPercent, systemSizeKw, productionFactor, batteryCapacity,
    batteryEfficiency, days, nightPercent,
  });

  const economics = useMemo(
    () => computeEconomics({ totalSavings: results.totalSavings, days, systemCost }),
    [results.totalSavings, days, systemCost]
  );

  /* Presentation-only ratios of the locked outputs. None of these feed back
     into how energy is allocated. */
  const derived = useMemo(() => {
    const billNow = Number.isFinite(billAmount) ? billAmount : 0;
    const gridDrawn = results.remainingDayUsage + results.remainingNightUsage;
    return {
      gridDrawn,
      selfSufficiency:
        results.totalKwh > 0 ? (1 - gridDrawn / results.totalKwh) * 100 : 0,
      credit: Math.max(0, results.totalSavings - billNow),
      // What the customer's own power is worth, split the way they'd describe
      // it: used straight away, stored for tonight, sold back.
      savingUsedNow: results.savingsSelfConsumed,
      savingStored: results.savingsBattery,
      savingSoldBack: results.savingsExport,
    };
  }, [results, billAmount]);

  return {
    // site
    customerName, setCustomerName,
    address, setAddress,
    siteImage, setSiteImage,
    // tariff
    supplyCharge, setSupplyCharge,
    usageCharge, setUsageCharge,
    feedInTariff, setFeedInTariff,
    // bill
    billAmount, setBillAmount,
    billPeriod, setBillPeriod,
    dayPercent, setDayPercent,
    nightPercent,
    // system
    systemSizeKw, setSystemSizeKw,
    batteryCapacity, setBatteryCapacity,
    batteryEfficiency, setBatteryEfficiency,
    systemCost, setSystemCost,
    // yield
    region, setRegion: (v) => { setRegion(v); setFactorOverride(null); },
    season, setSeason: (v) => { setSeason(v); setFactorOverride(null); },
    productionFactor,
    setFactorOverride,
    suggestedFactor,
    factorIsOverridden,
    regionLabel: REGIONS[region]?.label ?? "",
    // derived
    days, periodWord, periodShort,
    results, economics, derived,
    hasBattery: batteryCapacity > 0,
  };
}
