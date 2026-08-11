# Helios

Solar + battery quoting. Enter a customer's bill and tariff, split their usage
between day and night, size a system and a battery, and read out the saving,
the energy balance and the payback.

Two modes over one quote, switched from the toggle in the header:

- **Rep input** — every field on screen at once, built for punching numbers in
  fast while talking to a customer. Dark icon rail, properties panel on the
  left, energy and savings read-out on the right.
- **Show customer** — the screen the rep turns around. Plain English, big
  numbers, a donut of where their power comes from, and the export actions. No
  industry words: a customer reads "power you sell back to the grid", never
  "feed-in tariff".

A third path has no toggle: opening a **share link** renders the proposal
read-only, because whoever follows that link is the customer at their kitchen
table, not the rep.

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
  calc/solarCalc.js         LOCKED calculation — computeResults() + useSolarResults()
                            plus computeEconomics()
  calc/solarCalc.test.js    verified case + one guard per locked rule
  state/useQuote.js         one quote's inputs, shared by both modes
  lib/format.js             AUD and en-AU formatting — all of it, in one place
  lib/proposal.js           buildProposal() → plain data; share-link encoding
  lib/proposal.test.js
  lib/projection.js         20 years of bills with and without the system
  lib/projection.test.js
  lib/siteImage.js          upload + satellite providers, address tidying
  RepMode.jsx               the rep's input screen
  CustomerMode.jsx          presentation wrapper — document + export actions
  ProposalDocument.jsx      the customer-facing proposal, rendered from data
  components/SitePanel.jsx  address, customer name, house image
  components/EnergyDonut.jsx
  design/layout.js          panel arrays + notes; panel count -> kW
  design/layout.test.js
  design/DesignCanvas.jsx   the SVG work surface (also renders read-only on the proposal)
  design/DesignStage.jsx    tools, properties panel, array list
  components/ProjectionCharts.jsx
  components/ui.jsx         panels, property rows, stat tiles, allocation bars
  App.jsx                   mode toggle, share-link routing
```

## Average hours of sunlight

One number, typed in: how many hours of good sun a day. Multiply by system size
for daily output.

```
6.6 kW x 5 hrs = 33 kWh a day, every day of the year
```

That is the whole yield model, deliberately. Earlier versions carried a
state-by-state table, a summer/winter split, an hour-by-hour load shape against
a solar curve, and a clear/mixed/overcast weather mix. All of it was more
defensible on paper and none of it was worth the complexity for a tool a rep
uses in a driveway — a quoting number you can explain to a customer in one
sentence beats a better one you cannot. Sitting in git history if it is ever
wanted back.

The field is editable, so set it to whatever your own installs actually do.

What this trades away, stated plainly: no seasonal variation (a winter quote
reads the same as a summer one), and solar is assumed to cover daytime usage
whenever daily production exceeds it, so self-sufficiency can read 100%.

## How usage is established

Two ways, and the order matters.

**Read the kWh off the bill** (preferred). Every Australian bill prints it. It's
a measurement, so nothing can distort it.

**Work it back from the dollar amount** (fallback). `(bill − supply charge) ÷
usage rate`. This assumes every kWh was billed at one flat rate, which is wrong
the moment the account has controlled-load hot water, an off-peak block, a
tiered rate or a pay-on-time discount. Each of those puts the customer's real
average rate *below* the headline one — and dividing by the headline rate then
**understates** how much power they actually use.

Worked example, from a rep who spotted it in the field:

```
$200/month bill · $1.70/day supply · 32c/kWh
  → ($200 − $51 supply) ÷ 32c = 466 kWh/month = 15.5 kWh/day

But if that customer really uses 20 kWh/day (600 kWh), their average
rate is 24.8c, not 32c — and the back-calculation was 22% low.
```

When usage is stated directly, the app divides the bill's usage portion by it
and shows the customer's real rate. More than 8% away from the entered tariff
and it says so, because that gap is a controlled load or a discount worth
knowing about before quoting.

## The design screen

A flat 2D work surface over the site image: drop panel arrays on the roof, drag
them into place, rotate them, and drop annotations wherever something needs
calling out. Reached from the **Design** tab.

Flat and 2D deliberately — a rep is placing panels on a roof they can see, not
modelling a building, and a surface that rotates in three axes makes that
harder rather than easier.

**The layout sets the system size.** 18 panels at 440 W is a 7.92 kW system, and
the Energy tab's size field goes read-only saying where the number came from.
That is the screen's one real job: without it the layout would be decoration and
the rep would still be typing a size by hand.

Everything lives in the viewBox units of an SVG laid over the image — 1000 wide,
and however tall the image's aspect ratio makes it. One uniform coordinate
system means rotation behaves, drag maths stays simple, and the same markup
scales into the customer's proposal and the PDF, where it renders read-only.

What it is not: no shading study, no string design, no roof measurement, no
panel-level production. Anything claiming those would need a real site survey.

## Finding the property

Type an address, pick it from the suggestions, and the aerial view drops in on
its own. `lib/addressSearch.js` + `components/AddressSearch.jsx`.

Underneath it stays a plain text input: a rep can type an address no provider
knows — a new estate, a rural property — and the quote still works. The
suggestions are an accelerator, never a gate. Debounced at 280 ms, in-flight
requests aborted on the next keystroke, full keyboard support, wired as a
combobox.

**Providers** (set `VITE_MAP_KEY`, and `VITE_MAP_PROVIDER` to pick one):

- **google** (default) — Places Autocomplete (New) for suggestions, then a Place
  lookup for coordinates, then Static Maps for the image. Best Australian
  address coverage. Enable Places API (New) + Maps Static API on the key.
- **mapbox** — Geocoding v5 returns coordinates with the suggestion, so it needs
  one request instead of two, then Static Images for the tile.

**Without a key** the field offers a short built-in list of sample addresses
under an amber "Sample addresses" banner. It exists so the flow can be
demonstrated, and it never pretends to have found a real property: picking one
fills the address and still asks for a photo. Inventing aerial imagery for a
real street would be worse than admitting there is none.

A browser-visible key is unavoidable for this. Restrict it by HTTP referrer in
the provider's console, and don't reuse a key that has billing-heavy APIs
enabled.

## The house image

Two paths, because one of them has to work on a rep's phone in a driveway:

- **Aerial view** — automatic once an address is chosen and a key is set; the
  image centres on the resolved coordinates rather than the address text, which
  frames the roof far more reliably.
- **Upload** — always available, and the only option without a key. Pick a photo
  or a screenshot; it's read as a data URL so it travels with the proposal and
  needs no hosting.

The image is the backdrop for the design screen and the proposal. It is for
personalisation and trust, not precision — there is no georeferencing behind it.

## The next twenty years

The most persuasive thing on a solar proposal is not this quarter's saving —
it is the gap that opens up once power prices keep climbing. `lib/projection.js`
builds both sides of that comparison and the customer screen draws two charts
from it.

- **What you'd pay each year** — grouped bars, the bill with and without solar.
- **What it adds up to** — running totals, with the system price charged to the
  solar side up front. The crossover is marked: the year it has paid for itself.

Everything compounds at one rate (default **5% a year**, editable in the rep's
panel). The bill rises because power costs more; the saving rises by exactly the
same amount, because avoiding a kWh is worth whatever that kWh now costs. No
second assumption is smuggled in.

`savingOver(n)` gives the total saved over the first n years, compounding the
annual saving at the same rate. At 5% a year, **ten years is 12.6x year one,
not 10x** — that is the figure on the rep's Return card. It is deliberately
uncapped, unlike the chart rows: those floor the remaining bill at zero because
a bill cannot go negative, which would quietly clip the saving once export
credits push the customer into credit.

The projection is rebuilt from four numbers at render time rather than stored
row by row — twenty rows of data would push a share link past what browsers
reliably carry in a URL.

Both charts are plain inline SVG: no chart library, and they print into the PDF
as vectors. Rose for money handed to the retailer, emerald for money kept —
checked for colour-blind separation, and every series carries a legend so
neither chart is read by colour alone.

## The proposal, and getting it out

`buildProposal()` turns the live quote into one plain serialisable object.
Everything downstream renders from that object rather than from React state:
the customer screen, the printed PDF, and the share link.

- **Download proposal** uses the browser's own print-to-PDF against the print
  stylesheet in `index.css`. No PDF dependency, text stays selectable, and it
  works on the tablet the rep is already holding.
- **Share link** encodes the proposal into the URL hash, so it needs no
  backend. Images are dropped from the link — a data URL would blow past URL
  length limits — so the PDF is the one that carries the house.

**On adding e-signature later:** the seam is already there. A signing service
wants a document plus signer details, and the proposal object *is* that
document. Its `signature` field is null until a provider fills it in. When the
time comes: POST the object, keep the returned envelope id, populate
`signature`. No other part of the app has to change.

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
4. **Production is a flat number of sun hours.** `SUN_HOURS_PER_DAY`, default 5,
   editable in the UI. Same every day of the year.
5. **The battery loses energy on the round trip.** Delivering L kWh after dark
   means storing `L / efficiency`, so the charge is sized on the delivered
   figure and the difference is booked as a real loss. Default 90%.

Anything the UI adds on top must be a *presentation* of these outputs. The
studio view's "self-sufficiency %" is an example: it is a ratio of numbers
`computeResults` already returned, computed in the component, and it never feeds
back into the allocation.

### The verified case

Pinned at 5 sun hours and a lossless battery, so the regression suite tests the
allocation logic rather than whatever the efficiency default happens to say.

```
supply $1.10/day · usage 32c/kWh · feed-in 6c/kWh · 60/40 day-night split
6.6 kW system · 16 kWh battery · 100% efficiency · 5 sun hours · 30-day month
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

1. **A hidden 5.0 kWh/kW/day yield.** Now an explicit, editable "average hours
   of sunlight" field rather than a constant buried in the code. Still 5 by
   default — the rep's call, not the code's.
2. **No battery round-trip losses.** Real batteries return about 90% of what
   goes in. *Fixed:* efficiency input, default 90%, loss shown as a line in the
   breakdown.
3. **"Day usage" treated as fully available to the array.** Not modelled — see
   "Average hours of sunlight" above for what that trades away.

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
