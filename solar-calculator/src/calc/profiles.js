/**
 * WHEN power gets used, and WHEN the sun is making it.
 *
 * The old model split usage into "day" and "night" and assumed every daytime
 * kWh could be met by the panels. That is what produced "From grid 0.0" — a
 * customer who never buys power again, which does not happen.
 *
 * The problem is that daytime usage is not spread evenly. It spikes at 6–8am
 * with kettles and showers, and again 5–9pm with cooking — and at both ends the
 * sun is low or gone. Solar can only offset what it overlaps.
 *
 * So the day is modelled hour by hour: a standard Australian residential load
 * shape against a solar curve, and self-consumption is the overlap between
 * them, hour by hour.
 *
 * THE DAY/NIGHT SLIDER STILL DRIVES IT. It sets how much of the total falls in
 * daylight hours versus dark ones; the shapes only decide how each of those
 * portions is distributed within its own hours. Set it to 60% and 60% of the
 * kWh still lands in daylight — it is just no longer assumed that all 60% meets
 * a panel that happens to be producing at that moment.
 */

/**
 * Relative demand by hour for a typical Australian home: quiet overnight, a
 * morning peak around 7am, the midday trough when the house is empty, and the
 * big evening peak from 5pm. Only the SHAPE matters — the values are rescaled
 * to whatever the bill says, so the absolute numbers here carry no units.
 */
export const LOAD_SHAPE = [
  0.55, 0.50, 0.48, 0.47, 0.50, 0.60, // 00–05
  0.95, 1.35, 1.25, 0.95, 0.80, 0.75, // 06–11
  0.75, 0.75, 0.78, 0.85, 1.05, 1.45, // 12–17
  1.90, 1.95, 1.70, 1.35, 1.00, 0.72, // 18–23
];

/**
 * Roughly when the sun is up and worth having. Winter days are shorter at both
 * ends, which is what makes the evening peak so expensive in June.
 */
export const DAYLIGHT = {
  annual: { sunrise: 6.5, sunset: 17.5 },
  summer: { sunrise: 5.5, sunset: 19.0 },
  winter: { sunrise: 7.0, sunset: 17.0 },
};

export const daylightFor = (season) => DAYLIGHT[season] ?? DAYLIGHT.annual;

/**
 * Output for one hour as a share of the day's total. A half-sine across the
 * daylight window: nothing before sunrise, a peak at solar noon, nothing after
 * sunset. Deliberately smooth — this is an average day, not a forecast.
 */
export function solarShape(season) {
  const { sunrise, sunset } = daylightFor(season);
  const span = sunset - sunrise;

  const raw = Array.from({ length: 24 }, (_, h) => {
    // Sample the middle of the hour so dawn and dusk hours get partial output
    // rather than all or nothing.
    const t = h + 0.5;
    if (t <= sunrise || t >= sunset) return 0;
    return Math.sin((Math.PI * (t - sunrise)) / span);
  });

  const total = raw.reduce((a, v) => a + v, 0);
  return total > 0 ? raw.map((v) => v / total) : raw;
}

/**
 * Split the day's usage across 24 hours, honouring the slider exactly.
 *
 * `dayPercent` of the total lands in daylight hours and the rest in dark ones;
 * within each group the load shape decides the distribution. If a season has no
 * dark hours or no daylight hours the shares collapse gracefully rather than
 * dividing by zero.
 */
export function loadProfile({ dailyUsage, dayPercent, season }) {
  const solar = solarShape(season);
  const isDaylight = solar.map((v) => v > 0);

  const dayWeight = LOAD_SHAPE.reduce((a, w, h) => a + (isDaylight[h] ? w : 0), 0);
  const nightWeight = LOAD_SHAPE.reduce((a, w, h) => a + (isDaylight[h] ? 0 : w), 0);

  const dayShare = Math.min(100, Math.max(0, dayPercent)) / 100;
  const nightShare = 1 - dayShare;

  const dayKwh = dailyUsage * dayShare;
  const nightKwh = dailyUsage * nightShare;

  const load = LOAD_SHAPE.map((w, h) => {
    if (isDaylight[h]) return dayWeight > 0 ? (w / dayWeight) * dayKwh : 0;
    return nightWeight > 0 ? (w / nightWeight) * nightKwh : 0;
  });

  return { load, solar, isDaylight, dayKwh, nightKwh };
}

/**
 * Lay the two curves over each other and read off the overlap.
 *
 * Returns, all in kWh for one average day:
 *   selfConsumed      — solar used the moment it was made
 *   excess            — solar with nowhere to go yet (battery or export)
 *   daytimeShortfall  — daylight-hour demand the panels could not meet
 *   darkLoad          — demand while the sun is down
 */
/**
 * Not every day is an average day, and that asymmetry costs the customer money.
 *
 * One "average day" of production quietly implies the sun behaves identically
 * every day. It does not. On a bright day the extra output has nowhere to go
 * and is exported at 6c; on an overcast day the house buys power at 32c and the
 * battery never fills. Averaging first hides both, and the error only runs one
 * way — it flatters the estimate.
 *
 * So the day is run three times, at three different levels of sun, and the
 * results are weighted. The factors are normalised so the weighted mean is
 * exactly 1.0: the annual yield the rep entered is preserved, only its spread
 * across days is modelled.
 */
const RAW_WEATHER_MIX = [
  { key: "clear", share: 0.35, factor: 1.3 },
  { key: "mixed", share: 0.4, factor: 1.0 },
  { key: "overcast", share: 0.25, factor: 0.45 },
];

const MEAN_FACTOR = RAW_WEATHER_MIX.reduce((a, d) => a + d.share * d.factor, 0);

export const WEATHER_MIX = RAW_WEATHER_MIX.map((d) => ({
  ...d,
  factor: d.factor / MEAN_FACTOR, // so the weighted mean output is unchanged
}));

export function overlapForDay({ dailyUsage, dailyProduction, dayPercent, season }) {
  const { load, solar, isDaylight } = loadProfile({ dailyUsage, dayPercent, season });

  let selfConsumed = 0;
  let excess = 0;
  let daytimeShortfall = 0;
  let darkLoad = 0;

  for (let h = 0; h < 24; h += 1) {
    const produced = dailyProduction * solar[h];
    const used = load[h];

    if (isDaylight[h]) {
      selfConsumed += Math.min(produced, used);
      excess += Math.max(0, produced - used);
      daytimeShortfall += Math.max(0, used - produced);
    } else {
      darkLoad += used;
    }
  }

  return { selfConsumed, excess, daytimeShortfall, darkLoad, load, solar, isDaylight };
}

/**
 * The full allocation for one representative day, run across the weather mix
 * and weighted back to a single set of daily averages.
 *
 * Running the battery inside the loop matters: on an overcast day there is not
 * enough spare solar to refill it, so it cannot cover that evening and the
 * house buys power. Averaging the sun first and allocating afterwards would
 * miss that entirely.
 *
 * Every figure returned is kWh for one average day. Multiplying by the number
 * of billing days happens at the end, in computeResults — the battery is still
 * a daily cap, applied once per day, never against a period total.
 */
export function allocateAverageDay({
  dailyUsage,
  dailyProduction,
  dayPercent,
  season,
  batteryKwh,
  efficiency,
}) {
  const totals = {
    selfConsumed: 0, excess: 0, batteryCharge: 0, batteryDelivered: 0,
    exported: 0, nightCovered: 0, dayCoveredByBattery: 0,
    remainingNight: 0, remainingDay: 0, daytimeShortfall: 0, darkLoad: 0,
  };

  for (const day of WEATHER_MIX) {
    const { selfConsumed, excess, daytimeShortfall, darkLoad } = overlapForDay({
      dailyUsage,
      dailyProduction: dailyProduction * day.factor,
      dayPercent,
      season,
    });

    // The battery only needs the top-up that will actually be drawn back out —
    // the dark hours plus whatever the panels missed at dawn and dusk.
    const unserved = darkLoad + daytimeShortfall;
    const needed = efficiency > 0 ? unserved / efficiency : 0;
    const charge = Math.min(excess, batteryKwh, needed);
    const delivered = charge * efficiency;

    // Full by mid-afternoon, so the evening and overnight load is served first.
    const nightCovered = Math.min(delivered, darkLoad);
    const dayCovered = Math.min(delivered - nightCovered, daytimeShortfall);

    const w = day.share;
    totals.selfConsumed += selfConsumed * w;
    totals.excess += excess * w;
    totals.batteryCharge += charge * w;
    totals.batteryDelivered += delivered * w;
    totals.exported += (excess - charge) * w;
    totals.nightCovered += nightCovered * w;
    totals.dayCoveredByBattery += dayCovered * w;
    totals.remainingNight += (darkLoad - nightCovered) * w;
    totals.remainingDay += (daytimeShortfall - dayCovered) * w;
    totals.daytimeShortfall += daytimeShortfall * w;
    totals.darkLoad += darkLoad * w;
  }

  return totals;
}
