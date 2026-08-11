import { useMemo, useState } from "react";

import { buildProjection, DEFAULT_PRICE_RISE } from "../lib/projection";
import { layoutKw, panelCount, DEFAULT_PANEL_WATTS, DEFAULT_ASPECT } from "../design/layout";
import {
  useSolarResults,
  computeEconomics,
  DAYS_IN_PERIOD,
  DEFAULT_BATTERY_EFFICIENCY,
  SUN_HOURS_PER_DAY,
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
  const [imageAspect, setImageAspect] = useState(DEFAULT_ASPECT);
  const [coords, setCoords] = useState(null); // { lat, lng } once an address resolves

  // Roof layout — panel arrays and annotations placed over the site image.
  const [arrays, setArrays] = useState([]);
  const [notes, setNotes] = useState([]);
  const [panelWatts, setPanelWatts] = useState(DEFAULT_PANEL_WATTS);

  // Tariff
  const [supplyCharge, setSupplyCharge] = useState(1.1); // $/day
  const [usageCharge, setUsageCharge] = useState(32); // c/kWh
  const [feedInTariff, setFeedInTariff] = useState(6); // c/kWh

  // Current bill
  const [billAmount, setBillAmount] = useState(450);
  // "known" reads the kWh off the bill; "fromBill" works it back from dollars.
  const [usageMode, setUsageMode] = useState("fromBill");
  const [knownUsageKwh, setKnownUsageKwh] = useState(0);
  const [billPeriod, setBillPeriod] = useState("quarterly"); // monthly | quarterly
  const [dayPercent, setDayPercent] = useState(60);

  // Proposed system
  const [typedSystemSizeKw, setTypedSystemSizeKw] = useState(6.6);

  // Panels on the roof win over a size typed by hand: once a layout exists it
  // IS the system, and letting the two disagree would put one number on the
  // design and a different one on the quote.
  const placedPanels = panelCount(arrays);
  const sizeFromLayout = placedPanels > 0;
  const systemSizeKw = sizeFromLayout ? layoutKw(arrays, panelWatts) : typedSystemSizeKw;
  const setSystemSizeKw = setTypedSystemSizeKw;
  const [batteryCapacity, setBatteryCapacity] = useState(0); // kWh, 0 = solar only
  const [batteryEfficiency, setBatteryEfficiency] = useState(DEFAULT_BATTERY_EFFICIENCY);
  const [systemCost, setSystemCost] = useState(6500); // $ net of STCs
  const [priceRisePercent, setPriceRisePercent] = useState(DEFAULT_PRICE_RISE);

  // Yield — a flat number of peak sun hours a day. 6.6 kW x 5 = 33 kWh/day.
  const [sunHours, setSunHours] = useState(SUN_HOURS_PER_DAY);
  const productionFactor = sunHours;

  const days = DAYS_IN_PERIOD[billPeriod];
  const nightPercent = 100 - dayPercent;

  // A rep thinks in kWh per day ("that house is a 26 a day"), a bill prints the
  // total for the period. Same figure, two units — so both are editable and
  // each writes through to the other.
  const knownUsagePerDay = days > 0 ? knownUsageKwh / days : 0;
  const setKnownUsagePerDay = (perDay) =>
    setKnownUsageKwh(Number.isFinite(perDay) ? perDay * days : 0);
  const periodWord = billPeriod === "monthly" ? "month" : "quarter";
  const periodShort = billPeriod === "monthly" ? "mo" : "qtr";

  const results = useSolarResults({
    supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod,
    knownUsageKwh: usageMode === "known" ? knownUsageKwh : 0,
    dayPercent, systemSizeKw, productionFactor, batteryCapacity,
    batteryEfficiency, days, nightPercent,
  });

  const economics = useMemo(
    () => computeEconomics({ totalSavings: results.totalSavings, days, systemCost }),
    [results.totalSavings, days, systemCost]
  );

  // Twenty years of bills either way. Consumes the annual figures, never feeds
  // back into the energy allocation.
  const annualBill = days > 0 ? ((Number.isFinite(billAmount) ? billAmount : 0) / days) * 365 : 0;
  const projection = useMemo(
    () =>
      buildProjection({
        annualBill,
        annualSaving: economics.annualSavings,
        systemCost,
        risePercent: priceRisePercent,
      }),
    [annualBill, economics.annualSavings, systemCost, priceRisePercent]
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
    usageMode, setUsageMode,
    knownUsageKwh, setKnownUsageKwh,
    knownUsagePerDay, setKnownUsagePerDay,
    billPeriod, setBillPeriod,
    dayPercent, setDayPercent,
    nightPercent,
    // design
    imageAspect, setImageAspect,
    coords, setCoords,
    arrays, setArrays,
    notes, setNotes,
    panelWatts, setPanelWatts,
    placedPanels, sizeFromLayout,
    // system
    systemSizeKw, setSystemSizeKw,
    batteryCapacity, setBatteryCapacity,
    batteryEfficiency, setBatteryEfficiency,
    systemCost, setSystemCost,
    priceRisePercent, setPriceRisePercent,
    annualBill, projection,
    // yield
    sunHours, setSunHours,
    productionFactor,
    // derived
    days, periodWord, periodShort,
    results, economics, derived,
    hasBattery: batteryCapacity > 0,
  };
}
