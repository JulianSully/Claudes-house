/**
 * Twenty years of power bills, with and without the system.
 *
 * The single most persuasive thing on a solar proposal is not this quarter's
 * saving — it is the gap that opens up over twenty years once power prices keep
 * climbing. This builds both sides of that comparison.
 *
 * Everything compounds at one rate, `risePercent`. The bill rises because power
 * costs more; the saving rises by exactly the same amount, because avoiding a
 * kWh is worth whatever that kWh now costs. So both lines are the year-one
 * figures compounded — no second assumption smuggled in.
 *
 * The cumulative side charges the system price to year one, which is what makes
 * the two totals honestly comparable and puts a visible crossover on the chart:
 * the year the system has paid for itself and starts making money.
 */

export const PROJECTION_YEARS = 20;
export const DEFAULT_PRICE_RISE = 5; // % a year

const num = (v) => (Number.isFinite(v) ? v : 0);

export function buildProjection({
  annualBill,
  annualSaving,
  systemCost,
  years = PROJECTION_YEARS,
  risePercent = DEFAULT_PRICE_RISE,
}) {
  const bill0 = Math.max(0, num(annualBill));
  const saving0 = Math.max(0, num(annualSaving));
  const cost = Math.max(0, num(systemCost));
  const rate = 1 + num(risePercent) / 100;

  // A saving bigger than the bill means the customer ends up in credit. For the
  // chart their bill simply bottoms out at zero; the credit is reported on the
  // savings side, not as a negative bill.
  const remaining0 = Math.max(0, bill0 - saving0);

  const rows = [];
  let cumulativeWithout = 0;
  let cumulativeWith = cost; // the system is paid for up front

  for (let i = 0; i < years; i += 1) {
    const factor = rate ** i;
    const withoutSolar = bill0 * factor;
    const withSolar = remaining0 * factor;

    cumulativeWithout += withoutSolar;
    cumulativeWith += withSolar;

    rows.push({
      year: i + 1,
      withoutSolar,
      withSolar,
      saved: withoutSolar - withSolar,
      cumulativeWithout,
      cumulativeWith,
      cumulativeSaved: cumulativeWithout - cumulativeWith,
    });
  }

  const last = rows[rows.length - 1] ?? null;

  // The first year the running total with solar drops below the running total
  // without it — i.e. the system has paid for itself.
  const breakEven = rows.find((r) => r.cumulativeWith <= r.cumulativeWithout) ?? null;

  return {
    years,
    risePercent: num(risePercent),
    systemCost: cost,
    rows,
    totalWithout: last ? last.cumulativeWithout : 0,
    totalWith: last ? last.cumulativeWith : 0,
    totalSaved: last ? last.cumulativeSaved : 0,
    breakEvenYear: breakEven ? breakEven.year : null,
    finalYearBill: last ? last.withoutSolar : 0,
  };
}
