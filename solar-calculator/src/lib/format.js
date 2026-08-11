/**
 * Australian formatting. Every figure a rep or a customer sees goes through
 * here, so AUD and en-AU conventions are decided in one place.
 */

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AUD_WHOLE = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("en-AU");

const num = (v) => (Number.isFinite(v) ? v : 0);

/** $1,234.56 — use where cents matter (line items, the new bill). */
export const money = (v) => AUD.format(num(v));

/** $1,235 — use for headline figures the customer reads at a glance. */
export const money0 = (v) => AUD_WHOLE.format(num(v));

/** 1,093 kWh */
export const kwh = (v) => `${NUM.format(Math.round(num(v)))} kWh`;

/** 27.1 kWh — for daily averages, where rounding to whole numbers lies. */
export const kwh1 = (v) => `${num(v).toFixed(1)} kWh`;

/** 6.6 kW / 16 kWh, trimmed of trailing zeroes. */
export const kw = (v) => `${Number(num(v).toFixed(2))} kW`;
export const kwhSize = (v) => `${Number(num(v).toFixed(2))} kWh`;

/** 24/03/2026 */
export const date = (d = new Date()) =>
  new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

/** 24 March 2026 — for the proposal, where the long form reads better. */
export const dateLong = (d = new Date()) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(d);

/** 8.4 years / "—" when there is nothing to show. */
export const years = (v) =>
  v === null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)} years`;

export const percent = (v) => `${Math.round(num(v))}%`;
