import { useState } from "react";
import { Sun, Moon, Zap, TrendingDown, Info, BatteryCharging } from "lucide-react";

import { useSolarResults, NUMBER } from "./calc/solarCalc";

function Field({ label, suffix, value, onChange, step = "0.1", min = "0" }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-400">
        {label}
      </span>
      <div className="mt-1.5 flex items-center rounded-lg bg-slate-800/70 border border-slate-700 focus-within:border-amber-400/60 transition-colors">
        <input
          type="number"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full bg-transparent px-3 py-2.5 text-slate-100 text-[15px] font-mono outline-none placeholder:text-slate-600"
          placeholder="0"
        />
        {suffix && (
          <span className="pr-3 text-xs text-slate-500 font-mono whitespace-nowrap">{suffix}</span>
        )}
      </div>
    </label>
  );
}

/**
 * The original dark estimator. The layout is untouched; the calculation that
 * used to live inline here now comes from ./calc/solarCalc so this view and the
 * studio view can never drift apart.
 */
export default function SolarSavingsCalculator() {
  const [supplyCharge, setSupplyCharge] = useState(1.1); // $/day
  const [usageCharge, setUsageCharge] = useState(32); // c/kWh
  const [feedInTariff, setFeedInTariff] = useState(6); // c/kWh
  const [billAmount, setBillAmount] = useState(450);
  const [billPeriod, setBillPeriod] = useState("quarterly"); // monthly | quarterly
  const [dayPercent, setDayPercent] = useState(60);
  const [systemSizeKw, setSystemSizeKw] = useState(6.6);
  const [productionFactor, setProductionFactor] = useState(5.0); // kWh/kW/day
  const [batteryCapacity, setBatteryCapacity] = useState(0); // kWh, 0 = no battery

  const days = billPeriod === "monthly" ? 30 : 91;
  const nightPercent = 100 - dayPercent;

  const results = useSolarResults({
    supplyCharge, usageCharge, feedInTariff, billAmount, billPeriod,
    dayPercent, systemSizeKw, productionFactor, batteryCapacity,
    days, nightPercent,
  });

  const fmt$ = (n) => `$${NUMBER(n).toFixed(2)}`;
  const fmtKwh = (n) => `${NUMBER(n).toFixed(0)} kWh`;

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 font-sans">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-amber-400 text-[11px] font-semibold tracking-[0.2em] uppercase mb-2">
            <Sun size={14} strokeWidth={2.5} />
            Solar Savings Estimator
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Bill in. Savings out.
          </h1>
          <p className="mt-2 text-slate-400 text-sm max-w-lg">
            Enter the tariff and current bill, split usage between day and night,
            then size the system to see the estimated saving.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4">
                Tariff
              </h2>
              <div className="space-y-4">
                <Field label="Supply charge" suffix="$ / day" value={supplyCharge} onChange={setSupplyCharge} step="0.01" />
                <Field label="Usage charge" suffix="c / kWh" value={usageCharge} onChange={setUsageCharge} step="0.5" />
                <Field label="Feed-in tariff" suffix="c / kWh" value={feedInTariff} onChange={setFeedInTariff} step="0.5" />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4">
                Current bill
              </h2>
              <div className="space-y-4">
                <Field label="Bill amount" suffix="$" value={billAmount} onChange={setBillAmount} step="1" />
                <div>
                  <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-400">
                    Billing period
                  </span>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {["monthly", "quarterly"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setBillPeriod(p)}
                        className={`rounded-lg py-2 text-sm font-medium capitalize transition-colors border ${
                          billPeriod === p
                            ? "bg-amber-400 text-slate-900 border-amber-400"
                            : "bg-slate-800/70 text-slate-300 border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4">
                Usage split
              </h2>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-1.5 text-amber-300"><Sun size={13} /> Day {dayPercent}%</span>
                <span className="flex items-center gap-1.5 text-slate-400"><Moon size={13} /> Night {nightPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={dayPercent}
                onChange={(e) => setDayPercent(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="mt-3 h-2 w-full rounded-full overflow-hidden flex bg-slate-800">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${dayPercent}%` }} />
                <div className="h-full bg-slate-700" style={{ width: `${nightPercent}%` }} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4">
                Proposed system
              </h2>
              <div className="space-y-4">
                <Field label="System size" suffix="kW" value={systemSizeKw} onChange={setSystemSizeKw} step="0.1" />
                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  Estimated at system size × 5 kWh/day — a 6.6kW system produces roughly 33 kWh/day
                  on average.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4 flex items-center gap-1.5">
                <BatteryCharging size={13} className="text-emerald-400" />
                Battery (optional)
              </h2>
              <div className="space-y-4">
                <Field label="Battery capacity" suffix="kWh" value={batteryCapacity} onChange={setBatteryCapacity} step="0.5" />
                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  Leftover solar after covering day usage tops the battery back up by whatever
                  last night drew out of it, and the rest is exported. That stored charge then
                  offsets night usage instead of paying full rate. Leave at 0 for a solar-only
                  estimate.
                </p>
              </div>
            </section>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-slate-900/60 to-slate-900/60 p-6 sm:p-8">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-300 mb-2">
                <TrendingDown size={13} />
                Estimated saving this {billPeriod === "monthly" ? "month" : "quarter"}
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl sm:text-6xl font-bold text-white font-mono tracking-tight">
                  {fmt$(results.totalSavings)}
                </span>
                <span className="text-amber-300 text-lg font-mono">
                  ({results.savingsPercent.toFixed(0)}% off)
                </span>
              </div>
              <div className="mt-5 flex items-center gap-6 text-sm">
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Old bill</div>
                  <div className="text-slate-300 font-mono line-through decoration-slate-600">{fmt$(billAmount)}</div>
                </div>
                <div className="text-slate-600">→</div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">New estimated bill</div>
                  <div className="text-white font-mono font-semibold">{fmt$(results.newBill)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4">
                Usage from bill
              </h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-mono font-semibold text-white">{fmtKwh(results.totalKwh)}</div>
                  <div className="text-xs text-slate-500 mt-1">Total / {billPeriod === "monthly" ? "mo" : "qtr"}</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-semibold text-amber-300 flex items-center justify-center gap-1">
                    <Sun size={16} />{fmtKwh(results.dayKwh)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Day usage</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-semibold text-slate-300 flex items-center justify-center gap-1">
                    <Moon size={16} />{fmtKwh(results.nightKwh)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Night usage</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300 mb-4 flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" />
                System production &amp; savings breakdown
              </h2>

              <div className="mb-5">
                <div className="text-2xl font-mono font-semibold text-white">{fmtKwh(results.systemProduction)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Estimated production ({systemSizeKw || 0} kW × {productionFactor || 0} kWh/kW/day × {days} days)
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3">
                  <div>
                    <div className="text-sm text-slate-200">Self-consumed (offsets day usage)</div>
                    <div className="text-xs text-slate-500 font-mono">{fmtKwh(results.selfConsumed)} at usage rate</div>
                  </div>
                  <div className="font-mono text-emerald-400 font-semibold">{fmt$(results.savingsSelfConsumed)}</div>
                </div>

                {batteryCapacity > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3">
                    <div>
                      <div className="text-sm text-slate-200 flex items-center gap-1.5">
                        <BatteryCharging size={13} className="text-emerald-400" />
                        Stored in battery, used at night
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{fmtKwh(results.nightCoveredByBattery)} at usage rate</div>
                    </div>
                    <div className="font-mono text-emerald-400 font-semibold">{fmt$(results.savingsBattery)}</div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3">
                  <div>
                    <div className="text-sm text-slate-200">Exported to grid</div>
                    <div className="text-xs text-slate-500 font-mono">{fmtKwh(results.exported)} at feed-in tariff</div>
                  </div>
                  <div className="font-mono text-emerald-400 font-semibold">{fmt$(results.savingsExport)}</div>
                </div>

                {results.remainingDayUsage > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-800/30 px-4 py-3 border border-dashed border-slate-700">
                    <div className="text-sm text-slate-400">
                      Day usage not covered by system
                    </div>
                    <div className="font-mono text-slate-400">{fmtKwh(results.remainingDayUsage)}</div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg bg-slate-800/30 px-4 py-3 border border-dashed border-slate-700">
                  <div className="text-sm text-slate-400">
                    {batteryCapacity > 0 ? "Night usage — still on grid" : "Night usage — unaffected (no battery)"}
                  </div>
                  <div className="font-mono text-slate-400">
                    {fmtKwh(batteryCapacity > 0 ? results.remainingNightUsage : results.nightKwh)}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed px-1">
              This is a simplified daily-average estimate for quick quoting — it doesn't account for
              day-to-day variability, battery efficiency losses, or seasonal shifts in production and
              usage. For a precise proposal, load the customer's actual interval data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
