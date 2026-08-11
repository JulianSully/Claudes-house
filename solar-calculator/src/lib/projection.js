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
  let cumulativeSaving = 0; // saving alone, with nothing netted off

  for (let i = 0; i < years; i += 1) {
    const factor = rate ** i;
    const withoutSolar = bill0 * factor;
    const withSolar = remaining0 * factor;

    const saved = withoutSolar - withSolar;

    cumulativeWithout += withoutSolar;
    cumulativeWith += withSolar;
    cumulativeSaving += saved;

    rows.push({
      year: i + 1,
      withoutSolar,
      withSolar,
      saved,
      cumulativeWithout,
      cumulativeWith,
      // Two different questions, deliberately kept apart:
      //   cumulativeSaving — what the system saved them, full stop.
      //   cumulativeSaved  — the same, less what the system cost, so it starts
      //                      negative and turns positive at the crossover.
      cumulativeSaving,
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
    /**
     * Total saved over the first `n` years: the annual saving, compounded at
     * the same rate as power prices. At 5% a year, ten years is worth about
     * 12.6 times year one, not 10.
     *
     * Deliberately uncapped, unlike the chart rows. Those floor the remaining
     * bill at zero, because a bill cannot go negative — which silently clips
     * the saving once export credits push the customer into credit. That is the
     * right call for a bar chart and the wrong one for "what did it save me",
     * so this compounds the saving on its own terms.
     */
    savingOver: (n) => {
      const term = Math.max(0, Math.floor(n));
      if (term === 0 || saving0 === 0) return 0;
      if (rate === 1) return saving0 * term;
      return (saving0 * (rate ** term - 1)) / (rate - 1);
    },
    totalWithout: last ? last.cumulativeWithout : 0,
    totalWith: last ? last.cumulativeWith : 0,
    totalSaved: last ? last.cumulativeSaved : 0,
    breakEvenYear: breakEven ? breakEven.year : null,
    finalYearBill: last ? last.withoutSolar : 0,
  };
}
