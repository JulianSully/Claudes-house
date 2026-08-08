import { useState } from "react";
import {
  Sun,
  Moon,
  Zap,
  BatteryCharging,
  Info,
  Receipt,
  LayoutGrid,
  PanelsTopLeft,
  Users,
  FileText,
  Settings,
  Share2,
  ChevronRight,
  MapPin,
  TrendingDown,
  Gauge,
} from "lucide-react";

import { useSolarResults, DAYS_IN_PERIOD, PRODUCTION_FACTOR } from "./calc/solarCalc";
import { Panel, InputRow, Segmented, Card, StatTile, AllocationBar } from "./components/ui";

/* Validated categorical palette (light surface) — amber = solar used directly,
 * emerald = stored and used at night, blue = exported. The neutral fill is the
 * remainder still bought from the grid, not a fourth series. */
const C = {
  solar: "#D97706",
  battery: "#059669",
  exported: "#3163F5",
  grid: "#E2E8F0",
  gridInk: "#475569",
};

const NAV = [
  { icon: LayoutGrid, label: "Projects" },
  { icon: PanelsTopLeft, label: "Design" },
  { icon: Zap, label: "Energy", active: true },
  { icon: FileText, label: "Proposal" },
  { icon: Users, label: "Customers" },
];

const STAGES = ["Design", "Energy", "Proposal", "Contract"];

export default function PylonCalculator({ onOpenClassic }) {
  const [supplyCharge, setSupplyCharge] = useState(1.1); // $/day
  const [usageCharge, setUsageCharge] = useState(32); // c/kWh
  const [feedInTariff, setFeedInTariff] = useState(6); // c/kWh
  const [billAmount, setBillAmount] = useState(450);
  const [billPeriod, setBillPeriod] = useState("quarterly"); // monthly | quarterly
  const [dayPercent, setDayPercent] = useState(60);
  const [systemSizeKw, setSystemSizeKw] = useState(6.6);
  const [productionFactor] = useState(PRODUCTION_FACTOR); // fixed, not a UI input
  const [batteryCapacity, setBatteryCapacity] = useState(0); // kWh, 0 = no battery

  const days = DAYS_IN_PERIOD[billPeriod];
  const nightPercent = 100 - dayPercent;
  const periodWord = billPeriod === "monthly" ? "month" : "quarter";
  const periodShort = billPeriod === "monthly" ? "mo" : "qtr";

  const results = useSolarResults({
    supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod,
    dayPercent, systemSizeKw, productionFactor, batteryCapacity,
    days, nightPercent,
  });

  /* Display-only ratios of the locked outputs. These never feed back into the
   * energy allocation — they just re-present numbers already computed. */
  const gridDrawn = results.remainingDayUsage + results.remainingNightUsage;
  const selfSufficiency =
    results.totalKwh > 0 ? (1 - gridDrawn / results.totalKwh) * 100 : 0;

  const fmt$ = (n) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
  const fmt$0 = (n) => `$${Math.round(Number.isFinite(n) ? n : 0).toLocaleString()}`;
  const fmtKwh = (n) => `${(Number.isFinite(n) ? n : 0).toFixed(0)} kWh`;

  const hasBattery = batteryCapacity > 0;

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans text-slate-900 antialiased lg:h-screen lg:min-h-0">
      {/* ---------- icon rail ---------- */}
      <nav className="hidden sm:flex w-[60px] shrink-0 flex-col items-center bg-ink-900 py-3">
        <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white shadow-pop">
          <Sun size={18} strokeWidth={2.5} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {NAV.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-current={active ? "page" : undefined}
              className={`group grid h-10 w-10 place-items-center rounded-lg transition ${
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
            </button>
          ))}
        </div>
        <button
          type="button"
          title="Settings"
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-200"
        >
          <Settings size={17} strokeWidth={2} />
        </button>
        <div className="mt-2 grid h-8 w-8 place-items-center rounded-full bg-slate-700 text-[11px] font-semibold text-slate-200">
          JS
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------- top bar ---------- */}
        <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white lg:static">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[13px] text-slate-400">Projects</span>
              <ChevronRight size={13} className="text-slate-300" />
              <h1 className="truncate text-[14px] font-semibold text-slate-900">
                Residential — {systemSizeKw || 0} kW
                {hasBattery ? ` + ${batteryCapacity} kWh` : ""}
              </h1>
              <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 md:inline-flex">
                <MapPin size={11} /> Site estimate
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenClassic}
                className="hidden rounded-md border border-slate-300 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 lg:block"
              >
                Classic view
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Share2 size={13} /> Share
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-card transition hover:bg-brand-700"
              >
                <FileText size={13} /> Generate proposal
              </button>
            </div>
          </div>

          <div className="flex gap-5 overflow-x-auto px-5">
            {STAGES.map((s) => {
              const active = s === "Energy";
              return (
                <button
                  key={s}
                  type="button"
                  className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 pt-0.5 text-[13px] font-medium transition ${
                    active
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* ---------- left input panel ---------- */}
          <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-[340px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <Panel title="Proposed system" icon={Sun}>
              <InputRow
                label="System size"
                unit="kW"
                value={systemSizeKw}
                onChange={setSystemSizeKw}
                step="0.1"
              />
              <InputRow
                label="Battery capacity"
                hint="0 for solar only"
                unit="kWh"
                value={batteryCapacity}
                onChange={setBatteryCapacity}
                step="0.5"
              />
              <p className="flex items-start gap-1.5 pt-1 text-[11.5px] leading-relaxed text-slate-500">
                <Info size={12} className="mt-0.5 shrink-0 text-slate-400" />
                Production is estimated at {PRODUCTION_FACTOR} kWh per kW per day — a
                6.6 kW system averages about 33 kWh/day.
              </p>
            </Panel>

            <Panel title="Tariff" icon={Receipt}>
              <InputRow
                label="Supply charge"
                unit="$/day"
                value={supplyCharge}
                onChange={setSupplyCharge}
                step="0.01"
              />
              <InputRow
                label="Usage charge"
                unit="c/kWh"
                value={usageCharge}
                onChange={setUsageCharge}
                step="0.5"
              />
              <InputRow
                label="Feed-in tariff"
                unit="c/kWh"
                value={feedInTariff}
                onChange={setFeedInTariff}
                step="0.5"
              />
            </Panel>

            <Panel title="Current bill" icon={TrendingDown}>
              <InputRow
                label="Bill amount"
                unit="$"
                value={billAmount}
                onChange={setBillAmount}
                step="1"
              />
              <Segmented
                label="Billing period"
                value={billPeriod}
                onChange={setBillPeriod}
                options={[
                  { value: "monthly", label: "Month" },
                  { value: "quarterly", label: "Qtr" },
                ]}
              />
              <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
                Usage is back-calculated from the bill:{" "}
                <span className="font-mono text-slate-700">
                  ({fmt$(billAmount)} − {fmt$(supplyCharge * days)} supply) ÷{" "}
                  {usageCharge || 0}c
                </span>{" "}
                = <span className="font-mono text-slate-700">{fmtKwh(results.totalKwh)}</span>{" "}
                over {days} days.
              </div>
            </Panel>

            <Panel title="Usage profile" icon={Gauge}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                  <Sun size={13} /> Day {dayPercent}%
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                  <Moon size={13} /> Night {nightPercent}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={dayPercent}
                onChange={(e) => setDayPercent(Number(e.target.value))}
                aria-label="Share of usage consumed during daylight hours"
                className="w-full accent-brand-600"
              />
              <div className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full">
                <div style={{ width: `${dayPercent}%`, background: C.solar }} />
                <div style={{ width: `${nightPercent}%`, background: "#CBD5E1" }} />
              </div>
              <div className="flex justify-between pt-1 font-mono text-[11.5px] text-slate-500">
                <span>{fmtKwh(results.dayKwh)} day</span>
                <span>{fmtKwh(results.nightKwh)} night</span>
              </div>
            </Panel>
          </aside>

          {/* ---------- workspace ---------- */}
          <main className="min-w-0 flex-1 lg:overflow-y-auto">
            <div className="mx-auto max-w-[1100px] space-y-4 p-5 pb-24 lg:p-6">
              {/* hero + KPIs */}
              <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
                    Estimated saving per {periodWord}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-[44px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
                      {fmt$0(results.totalSavings)}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12.5px] font-semibold text-emerald-700">
                      {results.savingsPercent.toFixed(0)}% off the bill
                    </span>
                  </div>

                  <div className="mt-5 flex items-end gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-[11.5px] text-slate-500">
                        <span>Current bill</span>
                        <span className="font-mono tabular-nums">{fmt$(billAmount)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-300" />
                      <div className="mb-1 mt-3 flex justify-between text-[11.5px] text-slate-500">
                        <span>New estimated bill</span>
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          {fmt$(results.newBill)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
                          style={{
                            width: `${
                              billAmount > 0
                                ? Math.min(100, (results.newBill / billAmount) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 content-start">
                  <StatTile
                    label="Production"
                    value={fmtKwh(results.systemProduction)}
                    sub={`${results.dailyProduction.toFixed(1)} kWh/day avg`}
                    accent="amber"
                  />
                  <StatTile
                    label="Self-sufficiency"
                    value={`${selfSufficiency.toFixed(0)}%`}
                    sub={`${fmtKwh(gridDrawn)} still from grid`}
                    accent="brand"
                  />
                  <StatTile
                    label="Total usage"
                    value={fmtKwh(results.totalKwh)}
                    sub={`per ${periodShort} · ${days} days`}
                  />
                  <StatTile
                    label="Exported"
                    value={fmtKwh(results.exported)}
                    sub={`${fmt$(results.savingsExport)} at feed-in`}
                    accent="emerald"
                  />
                </div>
              </div>

              {/* daily energy balance */}
              <Card
                title="Daily energy balance"
                icon={Zap}
                subtitle="Averages for one day — the battery fills and empties once per day, then the day is multiplied out across the period."
                right={
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11.5px] text-slate-500">
                    × {days} days
                  </span>
                }
              >
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-[12.5px] font-medium text-slate-700">
                        Where the solar goes
                      </span>
                      <span className="font-mono text-[12px] text-slate-500 tabular-nums">
                        {results.dailyProduction.toFixed(1)} kWh produced
                      </span>
                    </div>
                    <AllocationBar
                      total={results.dailyProduction}
                      segments={[
                        {
                          key: "self",
                          label: "Used in the home",
                          value: results.dailySelfConsumed,
                          color: C.solar,
                        },
                        {
                          key: "batt",
                          label: "Charged to battery",
                          value: results.dailyBatteryCharge,
                          color: C.battery,
                        },
                        {
                          key: "exp",
                          label: "Exported",
                          value: results.dailyExported,
                          color: C.exported,
                        },
                      ]}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
                          <Sun size={13} className="text-amber-600" /> Day usage
                        </span>
                        <span className="font-mono text-[12px] text-slate-500 tabular-nums">
                          {results.dailyDayKwh.toFixed(1)} kWh
                        </span>
                      </div>
                      <AllocationBar
                        height={36}
                        total={results.dailyDayKwh}
                        segments={[
                          {
                            key: "solar",
                            label: "Covered by solar",
                            value: results.dailySelfConsumed,
                            color: C.solar,
                          },
                          {
                            key: "grid",
                            label: "From grid",
                            value: results.dailyRemainingDay,
                            color: C.grid,
                            textOn: C.gridInk,
                          },
                        ]}
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
                          <Moon size={13} className="text-slate-400" /> Night usage
                        </span>
                        <span className="font-mono text-[12px] text-slate-500 tabular-nums">
                          {results.dailyNightKwh.toFixed(1)} kWh
                        </span>
                      </div>
                      <AllocationBar
                        height={36}
                        total={results.dailyNightKwh}
                        segments={[
                          {
                            key: "batt",
                            label: "From battery",
                            value: results.dailyNightCovered,
                            color: C.battery,
                          },
                          {
                            key: "grid",
                            label: "From grid",
                            value: results.dailyRemainingNight,
                            color: C.grid,
                            textOn: C.gridInk,
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* breakdown */}
              <Card
                title="Savings breakdown"
                icon={Receipt}
                subtitle={`Totals for the ${periodWord} (${days} days)`}
              >
                <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[460px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.07em] text-slate-400">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 text-right font-medium">Energy</th>
                      <th className="pb-2 text-right font-medium">Rate</th>
                      <th className="pb-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <BreakdownRow
                      color={C.solar}
                      label="Self-consumed solar"
                      note="offsets day usage"
                      energy={fmtKwh(results.selfConsumed)}
                      rate={`${usageCharge || 0}c`}
                      value={fmt$(results.savingsSelfConsumed)}
                    />
                    {hasBattery && (
                      <BreakdownRow
                        color={C.battery}
                        label="Battery discharge"
                        note="offsets night usage"
                        energy={fmtKwh(results.nightCoveredByBattery)}
                        rate={`${usageCharge || 0}c`}
                        value={fmt$(results.savingsBattery)}
                      />
                    )}
                    <BreakdownRow
                      color={C.exported}
                      label="Exported to grid"
                      note="paid at feed-in tariff"
                      energy={fmtKwh(results.exported)}
                      rate={`${feedInTariff || 0}c`}
                      value={fmt$(results.savingsExport)}
                    />
                    {results.remainingDayUsage > 0 && (
                      <BreakdownRow
                        color={C.grid}
                        muted
                        label="Day usage still on grid"
                        energy={fmtKwh(results.remainingDayUsage)}
                        rate="—"
                        value="—"
                      />
                    )}
                    <BreakdownRow
                      color={C.grid}
                      muted
                      label={
                        hasBattery
                          ? "Night usage still on grid"
                          : "Night usage — unaffected (no battery)"
                      }
                      energy={fmtKwh(
                        hasBattery ? results.remainingNightUsage : results.nightKwh
                      )}
                      rate="—"
                      value="—"
                    />
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td className="pt-3 text-[13px] font-semibold text-slate-900" colSpan={3}>
                        Total saving per {periodWord}
                      </td>
                      <td className="pt-3 text-right font-mono text-[15px] font-semibold text-emerald-700 tabular-nums">
                        {fmt$(results.totalSavings)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </Card>

              {!hasBattery && (
                <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-[12.5px] leading-relaxed text-brand-900">
                  <BatteryCharging size={15} className="mt-0.5 shrink-0 text-brand-600" />
                  <div>
                    <span className="font-semibold">Night usage is untouched.</span>{" "}
                    {fmtKwh(results.dailyExported)}/day is being exported at{" "}
                    {feedInTariff || 0}c instead of covering {results.dailyNightKwh.toFixed(1)}{" "}
                    kWh/day of night usage at {usageCharge || 0}c. Add a battery above to
                    model it.
                  </div>
                </div>
              )}

              <p className="px-1 pb-2 text-[11.5px] leading-relaxed text-slate-400">
                Simplified daily-average estimate for quick quoting. It doesn't account for
                day-to-day variability, battery round-trip efficiency losses, inverter
                clipping, or seasonal shifts in production and usage. For a firm proposal,
                load the customer's actual interval data.
              </p>
            </div>
          </main>
        </div>

        {/* Small screens scroll the panel and the results as one page, so the
            headline number is pinned where it stays visible while editing. */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Saving / {periodWord}
            </div>
            <div className="font-mono text-[19px] font-semibold leading-tight text-slate-900 tabular-nums">
              {fmt$0(results.totalSavings)}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              New bill
            </div>
            <div className="font-mono text-[19px] font-semibold leading-tight text-emerald-700 tabular-nums">
              {fmt$(results.newBill)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ color, label, note, energy, rate, value, muted }) {
  return (
    <tr className={muted ? "text-slate-400" : "text-slate-700"}>
      <td className="py-2.5">
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: color }}
            aria-hidden="true"
          />
          <span>
            {label}
            {note && <span className="block text-[11.5px] text-slate-400">{note}</span>}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap py-2.5 pl-3 text-right font-mono tabular-nums">{energy}</td>
      <td className="whitespace-nowrap py-2.5 pl-3 text-right font-mono tabular-nums text-slate-400">
        {rate}
      </td>
      <td
        className={`whitespace-nowrap py-2.5 pl-3 text-right font-mono font-semibold tabular-nums ${
          muted ? "text-slate-300" : "text-emerald-700"
        }`}
      >
        {value}
      </td>
    </tr>
  );
}
