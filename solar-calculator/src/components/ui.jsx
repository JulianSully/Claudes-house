import { useId } from "react";

/* ------------------------------------------------------------------ *
 * Shared primitives for the studio UI.
 * Nothing in here touches the calculation — presentation only.
 * ------------------------------------------------------------------ */

export function Panel({ title, icon: Icon, action, children }) {
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <header className="flex items-center gap-2 px-5 pt-5 pb-3">
        {Icon && <Icon size={14} className="text-slate-400" strokeWidth={2} />}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
          {title}
        </h2>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="px-5 pb-5 space-y-2.5">{children}</div>
    </section>
  );
}

/** Label on the left, right-aligned numeric field with a unit — Pylon-style
 *  property row rather than a stacked form field. */
export function InputRow({ label, unit, value, onChange, step = "0.1", min = "0", hint }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <label htmlFor={id} className="text-[13px] text-slate-600 leading-tight">
        {label}
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </label>
      <div className="flex items-center h-9 w-[132px] rounded-md border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15 transition">
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full min-w-0 bg-transparent px-2.5 text-[13px] font-mono text-slate-900 text-right outline-none tabular-nums"
          placeholder="0"
        />
        {unit && (
          <span className="pr-2.5 pl-1 text-[11px] text-slate-400 whitespace-nowrap select-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <span className="text-[13px] text-slate-600">{label}</span>
      <div className="flex w-[132px] rounded-md bg-slate-100 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`flex-1 rounded-[5px] py-1.5 text-[12px] font-medium capitalize transition ${
              value === o.value
                ? "bg-white text-slate-900 shadow-card"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Card({ title, icon: Icon, subtitle, right, children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
    >
      {(title || right) && (
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
              {Icon && <Icon size={14} className="text-slate-400" strokeWidth={2} />}
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</p>}
          </div>
          {right && <div className="ml-auto shrink-0">{right}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, sub, accent = "slate" }) {
  const accents = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    brand: "text-brand-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-card">
      <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-[22px] font-semibold tabular-nums ${accents[accent]}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function LegendDot({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
      <span
        className="h-2.5 w-2.5 rounded-[3px] shrink-0"
        style={{ background: color }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/**
 * Horizontal stacked allocation bar.
 * `segments`: [{ key, label, value, color, textOn }] — value in the same unit.
 * Every segment is direct-labelled and separated by a 2px surface gap, which is
 * the secondary encoding the palette's CVD margin requires.
 */
export function AllocationBar({ segments, total, unit = "kWh", height = 44 }) {
  const sum = total || segments.reduce((a, s) => a + s.value, 0);
  const visible = segments.filter((s) => s.value > 0.0001);

  if (sum <= 0 || visible.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[12px] text-slate-400"
        style={{ height }}
      >
        No production
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-[2px]" style={{ height }}>
        {visible.map((s) => {
          const pct = (s.value / sum) * 100;
          return (
            <div
              key={s.key}
              className="relative first:rounded-l-[4px] last:rounded-r-[4px] overflow-hidden flex items-center justify-center"
              style={{ width: `${pct}%`, background: s.color, minWidth: 3 }}
              title={`${s.label}: ${s.value.toFixed(1)} ${unit} (${pct.toFixed(0)}%)`}
            >
              {pct > 11 && (
                <span
                  className="px-1 font-mono text-[11.5px] font-semibold tabular-nums truncate"
                  style={{ color: s.textOn || "#fff" }}
                >
                  {s.value.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <LegendDot key={s.key} color={s.color}>
            {s.label}
            <span className="font-mono tabular-nums text-slate-400">
              {s.value.toFixed(1)} {unit}
            </span>
          </LegendDot>
        ))}
      </div>
    </div>
  );
}
