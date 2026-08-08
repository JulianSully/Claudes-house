# Solar + Battery Savings Calculator

A quick-quoting estimator: enter a customer's bill and tariff, split their usage
between day and night, size a system and a battery, and read out the saving.

Two shells sit over one set of locked maths:

- **Studio** (default) — a solar-software workspace UI: dark icon rail, project
  header with stage tabs, a properties panel of inputs on the left and the energy
  and savings read-out on the right.
- **Classic** — the original dark estimator, kept verbatim. Toggle from the
  "Classic view" button in the header.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # the calculation guards — run these after any maths change
npm run build
```

## Layout

```
src/
  calc/solarCalc.js        LOCKED calculation — computeResults() + useSolarResults()
                           plus REGIONS (yield table) and computeEconomics()
  calc/solarCalc.test.js   verified case + one guard per locked rule
  PylonCalculator.jsx      studio UI (default view)
  SolarSavingsCalculator.jsx  original dark estimator, verbatim
  components/ui.jsx        panels, property rows, stat tiles, allocation bars
  App.jsx                  view toggle
```

## The locked calculation

`src/calc/solarCalc.js` is the single source of truth for the estimate. Do not
change the maths in `computeResults` — it encodes four rules:

1. **Production is per day.** `systemSizeKw × productionFactor` gives a *daily*
   figure. It is never multiplied by the number of billing days before the
   battery cap is applied.
2. **The battery is a daily cap.** It charges and discharges once every day of
   the billing period, not once for the whole period. All battery, production
   and export maths runs on daily averages first and is multiplied by `days` at
   the very end. *This was a real bug, already found and fixed — don't
   reintroduce it.*
3. **Priority order.** solar → day usage (self-consumption) → battery (takes
   the top-up it needs) → export (everything else). Then separately:
   battery → night usage → grid (whatever the battery can't cover).

   The battery is topped up by **what last night drew out of it**, not to its
   full capacity — it starts each day already holding whatever the night didn't
   consume. A 16 kWh battery serving a 10 kWh night load takes on 10 kWh and
   the rest of the spare solar is exported. So the daily charge is capped three
   ways: `min(spare solar, capacity, night load)`.
4. **Production factor comes from location and season.** It was originally a
   hidden constant of 5 kWh/kW/day. That is optimistic as an annual average for
   most of Australia, and a hidden constant of that size was the single biggest
   unchecked lever in the whole estimate, so it is now driven by a region and
   season selector and stays editable. See `REGIONS` in `solarCalc.js`.
5. **The battery loses energy on the round trip.** Delivering L kWh after dark
   means storing `L / efficiency`, so the charge is sized on the delivered
   figure and the difference is booked as a real loss. Default 90%.

Anything the UI adds on top must be a *presentation* of these outputs. The
studio view's "self-sufficiency %" is an example: it is a ratio of numbers
`computeResults` already returned, computed in the component, and it never feeds
back into the allocation.

### Yield assumptions

`REGIONS` holds an indicative annual average plus summer and winter figures for
each state. **They are planning numbers, not measurements.** Published sources
disagree by a few tenths — CEC-derived zone ratings put Sydney anywhere between
3.9 and 4.2 — and real yield moves with tilt, orientation, shading and soiling.
The field is editable for exactly that reason, and the numbers should be
recalibrated against your own monitoring data as soon as there are enough
installs to do it.

The seasonal spread matters more than the annual figure when quoting: a customer
sold on an annual average whose system is commissioned in May judges it against
the winter number. Quoting Sydney in winter drops production from 4.1 to 3.0
kWh/kW/day and the sample quote from $429 to $389 a quarter.

### The verified case

Pinned at the legacy 5.0 kWh/kW/day factor and a lossless battery, so the
regression suite tests the allocation logic rather than whatever the region
table or the efficiency default happen to say.

```
supply $1.10/day · usage 32c/kWh · feed-in 6c/kWh · 60/40 day-night split
6.6 kW system · 16 kWh battery · 100% efficiency · 5.0 kWh/kW/day · 30-day month
→ 775 kWh total (465 day / 310 night)
→ day usage fully covered, night usage fully covered
→ 0 kWh of night usage left on the grid
→ 33 produced − 15.5 day − 10.33 battery top-up = 7.17 kWh/day exported
```

`npm test` pins every one of those numbers, plus a guard per rule above. Two
guards earn their keep:

- a month and a quarter describing the *same daily consumption* must produce
  identical daily figures — this breaks the moment the battery cap is applied
  to a period total instead of a day;
- `nightCoveredByBattery == batteryCharge` across every battery size and bill —
  nothing may be stored that isn't drawn back out.

## Audit findings

The calculation was swept across 240 input combinations (2 periods × 6 bills ×
5 battery sizes × 4 system sizes) checking energy and value conservation.

**Clean:**

- Production always balances: `selfConsumed + batteryCharge + exported ==
  production`, exactly, in every case.
- Usage savings never exceed the usage portion of the bill — the model can't
  overstate a saving. `selfConsumed ≤ dayKwh` and `nightCovered ≤ nightKwh`
  hold by construction.

**Fixed — stored energy that was never used or credited.**

The battery used to fill to capacity before anything was exported, while only
ever discharging into night usage. Whenever the battery was larger than the
night load, the difference was neither consumed nor exported: it earned no
feed-in credit and simply left the accounting.

```
before:  $450/quarter, 6.6 kW, 16 kWh battery
         production 3003 kWh = self 656 + charged 1456 + exported 891
         of the 1456 kWh charged, only 437 kWh was used at night
         → 1019 kWh earned nothing.  At 6c that is $61 of unclaimed feed-in.

after:   production 3003 kWh = self 656 + charged 437 + exported 1910
         everything charged is drawn back out that night
         → quote goes from $403.36 to $464.47
```

Worst case found in the sweep (27 kWh battery, low bill) was 2457 kWh, about
$147 per quarter.

The fix is rule 3 as it now stands: the battery takes the top-up it needs,
`min(spare solar, capacity, night load)`, and everything else is sold. This
moved the verified case's export figure from 1.50 to 7.17 kWh/day and its
saving from $250.70 to $260.90; the day and night coverage in that case is
unchanged. Both views now read from `solarCalc.js`, so neither can drift.

**Also fixed (display only):** `newBill` is floored at zero while
`savingsPercent` is not, so a customer whose savings exceed their bill saw
"$0.00" next to "103% off". The studio view now shows the excess as an explicit
credit alongside the new bill.

## The estimate was over-quoting

Three separate things all pushed the saving the same way — up — and the first
two have since been addressed:

1. **A hidden 5.0 kWh/kW/day yield.** Optimistic as an annual average for most
   of the country; roughly 20% high against a Sydney figure of ~4.1. *Fixed:*
   region + season selector, editable.
2. **No battery round-trip losses.** Real batteries return about 90% of what
   goes in. *Fixed:* efficiency input, default 90%, loss shown as a line in the
   breakdown.
3. **"Day usage" treated as fully available to the array.** A 60% day split
   includes early morning and evening when the array produces little or
   nothing, so self-consumption — the largest single component of the saving —
   is still the optimistic end. **Not fixed:** doing it properly means modelling
   the load shape against a production curve rather than splitting a day in two,
   which is a different calculation, not a tweak to this one. Flagged in the UI
   instead.

On the sample quote ($450/quarter, 6.6 kW, 16 kWh, Sydney annual) the first two
together moved the estimate from $464 to $429 a quarter.

## Economics

`computeEconomics` is deliberately separate from `computeResults` — it consumes
the saving and never feeds back into how energy is allocated. Simple payback
only: no tariff inflation, no panel degradation, no discount rate, and
`systemCost` is assumed to be the net price after rebates.

> **Note on the bill figure.** The brief quoted this case as a **$450/month**
> bill. At 32c/kWh with a $1.10/day supply charge, $450 over 30 days
> back-calculates to **1303.125 kWh**, not 775 — 775 kWh is what a **$281**
> monthly bill gives at those tariffs, and at 775 kWh every other number in the
> case (465/310, 1.5 kWh/day export, zero night on grid) lands exactly. The
> tests therefore pin the case at $281, and pin the $450 result separately so
> any drift in either is visible.
