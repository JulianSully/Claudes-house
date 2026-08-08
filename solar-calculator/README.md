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
3. **Priority order.** solar → day usage (self-consumption) → battery (charges
   with the leftover) → export (whatever remains once the battery is full).
   Then separately: battery → night usage → grid (whatever the battery can't
   cover).
4. **Production factor is fixed at 5 kWh/kW/day** and is intentionally not
   exposed as an input in the UI.

Anything the UI adds on top must be a *presentation* of these outputs. The
studio view's "self-sufficiency %" is an example: it is a ratio of numbers
`computeResults` already returned, computed in the component, and it never feeds
back into the allocation.

### The verified case

```
supply $1.10/day · usage 32c/kWh · feed-in 6c/kWh · 60/40 day-night split
6.6 kW system · 16 kWh battery · 30-day month
→ 775 kWh total (465 day / 310 night)
→ day usage fully covered, night usage fully covered
→ 1.5 kWh/day exported, 0 kWh of night usage left on the grid
```

`npm test` pins every one of those numbers, plus a guard per rule above — most
usefully, that a month and a quarter describing the *same daily consumption*
produce identical daily figures, which is what breaks the moment the battery cap
is applied to a period total instead of a day.

> **Note on the bill figure.** The brief quoted this case as a **$450/month**
> bill. At 32c/kWh with a $1.10/day supply charge, $450 over 30 days
> back-calculates to **1303.125 kWh**, not 775 — 775 kWh is what a **$281**
> monthly bill gives at those tariffs, and at 775 kWh every other number in the
> case (465/310, 1.5 kWh/day export, zero night on grid) lands exactly. The
> tests therefore pin the case at $281, and pin the $450 result separately so
> any drift in either is visible.
