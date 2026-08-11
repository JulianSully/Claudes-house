import { Sun, BatteryCharging, Home, Check, TrendingUp } from "lucide-react";

import EnergyDonut from "./components/EnergyDonut";
import { AnnualBillChart, CumulativeChart } from "./components/ProjectionCharts";
import { buildProjection } from "./lib/projection";
import { money, money0, kwh, dateLong, years } from "./lib/format";

/**
 * The customer-facing proposal, rendered from the plain proposal object built
 * by lib/proposal.js — never from live component state. That is what lets the
 * same markup serve the on-screen presentation, the printed PDF and, later, a
 * document sent to a signing service.
 *
 * Language rule for everything below: no industry words. A customer reads
 * "power you sell back to the grid", never "feed-in tariff"; "your battery
 * covers the evening", never "nightCoveredByBattery".
 */

const C = {
  solar: "#D97706",
  battery: "#059669",
  grid: "#CBD5E1",
};

export default function ProposalDocument({ proposal: p }) {
  const e = p.estimate;
  const period = p.billing.periodWord;
  const hasBattery = p.system.batteryKwh > 0;

  const outlook = p.outlook ?? {};
  const projection = buildProjection({
    annualBill: outlook.annualBill,
    annualSaving: outlook.annualSaving,
    systemCost: outlook.systemCost,
    risePercent: outlook.priceRisePercent,
  });
  const showOutlook = projection.totalWithout > 0;

  const segments = [
    {
      key: "sun",
      label: "Straight from your roof, during the day",
      sub: `${kwh(e.usedNow)} over the ${period}`,
      value: e.usedNow,
      color: C.solar,
    },
    ...(hasBattery
      ? [
          {
            key: "battery",
            label: "From your battery, after the sun goes down",
            sub: `${kwh(e.storedForNight)} over the ${period}`,
            value: e.storedForNight,
            color: C.battery,
          },
        ]
      : []),
    {
      key: "grid",
      label: "Still bought from the grid",
      sub: e.stillFromGrid > 0 ? `${kwh(e.stillFromGrid)} over the ${period}` : "Nothing",
      value: e.stillFromGrid,
      color: C.grid,
      isGrid: true,
    },
  ];

  return (
    <article className="proposal mx-auto w-full max-w-[860px] bg-white text-slate-900">
      {/* ---------- masthead ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-7 pb-5 pt-7">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-white">
              <Sun size={15} strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Helios</span>
          </div>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-balance">
            {p.customer.name ? `${p.customer.name}, here's` : "Here's"} what solar could do
            for your power bill
          </h1>
          {p.customer.address && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-slate-500">
              <Home size={13} /> {p.customer.address}
            </p>
          )}
        </div>
        <div className="ml-auto shrink-0 text-right text-[11.5px] leading-relaxed text-slate-500">
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-800">
            Estimate only
          </div>
          <div>{dateLong(new Date(p.createdAt))}</div>
          <div className="font-mono">{p.id}</div>
        </div>
      </header>

      {/* ---------- the house ---------- */}
      {p.site.imageSrc && (
        <figure className="relative mx-7 mt-6 overflow-hidden rounded-xl border border-slate-200">
          <img
            src={p.site.imageSrc}
            alt={`The property at ${p.customer.address || "this address"}`}
            className="block h-[230px] w-full object-cover"
          />
          <figcaption className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-ink-900/85 px-3 py-2 text-white backdrop-blur">
            <Sun size={14} className="text-amber-300" />
            <span className="text-[13px] font-semibold">
              {p.system.sizeKw} kW of panels
              {hasBattery ? ` + ${p.system.batteryKwh} kWh battery` : ""}
            </span>
          </figcaption>
        </figure>
      )}

      {/* ---------- the headline ---------- */}
      <section className="px-7 pt-7">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Your bill now
            </div>
            <div className="mt-1.5 font-mono text-[30px] font-semibold leading-none tabular-nums text-slate-500">
              {money0(p.billing.currentBill)}
            </div>
            <div className="mt-1 text-[12px] text-slate-500">every {period}</div>
          </div>

          <div
            className="hidden text-[22px] text-slate-300 sm:block"
            aria-hidden="true"
          >
            →
          </div>

          <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/60 px-5 py-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-emerald-800">
              Your bill after
            </div>
            <div className="mt-1.5 font-mono text-[30px] font-semibold leading-none tabular-nums text-emerald-800">
              {money0(e.newBill)}
            </div>
            <div className="mt-1 text-[12px] text-emerald-800/80">
              every {period}
              {e.credit > 0.5 && ` · plus ${money(e.credit)} back in credit`}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-ink-900 px-6 py-5 text-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                You'd save
              </div>
              <div className="mt-1 font-mono text-[40px] font-semibold leading-none tabular-nums">
                {money0(e.totalSaving)}
              </div>
              <div className="mt-1 text-[12.5px] text-slate-400">every {period}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[26px] font-semibold leading-none tabular-nums text-emerald-400">
                {money0(e.annualSaving)}
              </div>
              <div className="mt-1 text-[12.5px] text-slate-400">a year</div>
            </div>
          </div>
          <p className="mt-4 border-t border-white/10 pt-3 text-[12px] leading-relaxed text-slate-400">
            These are estimates, based off the information provided.
          </p>
        </div>
      </section>

      {/* ---------- where the power comes from ---------- */}
      <section className="px-7 pt-8">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
          Where your power would come from
        </h2>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-slate-600">
          Right now you buy all of it. With {p.system.sizeKw} kW on the roof
          {hasBattery ? ` and a ${p.system.batteryKwh} kWh battery` : ""}, most of your power
          becomes your own.
        </p>
        <div className="mt-5 rounded-xl border border-slate-200 px-5 py-5">
          <EnergyDonut segments={segments} />
        </div>
      </section>

      {/* ---------- what you're getting ---------- */}
      <section className="px-7 pt-8">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">What you'd be getting</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PlainCard
            icon={Sun}
            title={`${p.system.sizeKw} kW of solar panels`}
            body={`On an average day they'd make about ${Math.round(
              p.system.sizeKw * p.system.productionFactor
            )} kWh — roughly what your home uses in a day.`}
          />
          {hasBattery ? (
            <PlainCard
              icon={BatteryCharging}
              title={`${p.system.batteryKwh} kWh battery`}
              body="Stores the sunshine you don't use during the day, then runs the house through the evening instead of buying power back at full price."
            />
          ) : (
            <PlainCard
              icon={BatteryCharging}
              title="No battery in this quote"
              body="Power you don't use during the day gets sold back to the grid. Adding a battery would keep it for the evening instead."
            />
          )}
          <PlainCard
            icon={Check}
            title={`${money0(e.soldBack === 0 ? 0 : e.savingSoldBack)} from power you sell back`}
            body={`Anything your home doesn't need goes out to the grid — ${kwh(
              e.soldBack
            )} over the ${period}, which your retailer pays you for.`}
          />
          {p.system.installedPrice > 0 && (
            <PlainCard
              icon={Home}
              title={`Pays for itself in ${years(e.paybackYears)}`}
              body={`At ${money0(p.system.installedPrice)} installed, and saving ${money0(
                e.annualSaving
              )} a year at today's prices.`}
            />
          )}
        </div>
      </section>

      {/* ---------- the next twenty years ---------- */}
      {showOutlook && (
        <section className="px-7 pt-8">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            The next {projection.years} years
          </h2>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-slate-600">
            Power prices don't stand still. These assume they rise{" "}
            <strong className="font-semibold text-slate-800">
              {projection.risePercent}% a year
            </strong>
            , which is the part of the bill solar protects you from.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 px-5 py-5">
            <h3 className="text-[13.5px] font-semibold">What you'd pay each year</h3>
            <p className="mb-4 mt-0.5 text-[12px] text-slate-500">
              By year {projection.years} the bill without solar reaches{" "}
              {money0(projection.finalYearBill)}.
            </p>
            <AnnualBillChart projection={projection} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 px-5 py-5">
            <h3 className="text-[13.5px] font-semibold">What it adds up to</h3>
            <p className="mb-4 mt-0.5 text-[12px] text-slate-500">
              Running totals — the solar line includes the{" "}
              {money0(projection.systemCost)} for the system.
            </p>
            <CumulativeChart projection={projection} />

            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <OutlookFigure
                label={`Power over ${projection.years} years, no solar`}
                value={money0(projection.totalWithout)}
              />
              <OutlookFigure
                label="With solar, system included"
                value={money0(projection.totalWith)}
              />
              <OutlookFigure
                label={`You'd be ahead by`}
                value={money0(projection.totalSaved)}
                accent
              />
            </div>
          </div>
        </section>
      )}

      {/* ---------- the fine print, in plain words ---------- */}
      <footer className="mt-8 border-t border-slate-200 px-7 pb-8 pt-5">
        <p className="max-w-[70ch] text-[11.5px] leading-relaxed text-slate-500">
          <strong className="font-semibold text-slate-600">How we worked this out.</strong>{" "}
          We started from your current bill of {money(p.billing.currentBill)} a {period} and
          worked backwards to how much power you use — about {kwh(p.usage.totalKwh)}, split{" "}
          {p.billing.dayPercent}% during the day and {p.billing.nightPercent}% at night. We
          then assumed {p.assumptions.productionBasis}. {p.assumptions.note} This is an
          estimate to help you decide, not a contract or a guarantee.
        </p>
      </footer>
    </article>
  );
}

function OutlookFigure({ label, value, accent }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-[20px] font-semibold tabular-nums ${
          accent ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {accent && <TrendingUp size={15} className="mr-1 inline align-[-2px]" />}
        {value}
      </div>
    </div>
  );
}

function PlainCard({ icon: Icon, title, body }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Icon size={15} className="shrink-0 text-brand-600" />
        <h3 className="text-[13.5px] font-semibold leading-snug">{title}</h3>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
