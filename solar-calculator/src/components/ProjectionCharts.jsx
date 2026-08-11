import { money0 } from "../lib/format";

/**
 * Twenty years of power bills, drawn two ways.
 *
 * Both charts are plain inline SVG — no chart library — so they print into the
 * PDF as vectors and carry no dependency. Two series only, always with a legend
 * and with the first and last years directly labelled, so neither chart is ever
 * read by colour alone.
 *
 * Palette: rose for money handed to the retailer, emerald for money kept.
 * Checked for colour-blind separation against a white surface.
 */
const C = {
  without: "#BE123C",
  withSolar: "#059669",
  grid: "#E2E8F0",
  axis: "#94A3B8",
  ink: "#334155",
};

const W = 860;
const H = 250;
const PAD = { top: 16, right: 12, bottom: 30, left: 64 };
const PLOT = {
  x: PAD.left,
  y: PAD.top,
  w: W - PAD.left - PAD.right,
  h: H - PAD.top - PAD.bottom,
};

/**
 * Round ticks that always reach ABOVE the largest value — the top tick is the
 * top of the plot, so a scale that stopped short would draw the tallest bar or
 * the steepest line straight off the chart.
 */
const niceTicks = (max, count = 4) => {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
};

function Frame({ ticks, scaleY, children, ariaLabel }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block", minWidth: 520 }}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PLOT.x}
            x2={PLOT.x + PLOT.w}
            y1={scaleY(t)}
            y2={scaleY(t)}
            stroke={C.grid}
            strokeWidth="1"
          />
          <text
            x={PLOT.x - 10}
            y={scaleY(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill={C.axis}
            fontFamily="ui-monospace, monospace"
          >
            {money0(t)}
          </text>
        </g>
      ))}
      {children}
    </svg>
  );
}

function XLabels({ rows, scaleX, everyN = 5 }) {
  return rows.map((r, i) =>
    r.year === 1 || r.year % everyN === 0 ? (
      <text
        key={r.year}
        x={scaleX(i)}
        y={H - 10}
        textAnchor="middle"
        fontSize="11"
        fill={C.axis}
        fontFamily="ui-monospace, monospace"
      >
        {r.year === 1 ? "Yr 1" : r.year}
      </text>
    ) : null
  );
}

function Legend({ items }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-[12.5px] text-slate-600">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: i.color }}
            aria-hidden="true"
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * 1. What you'd pay each year
 * ------------------------------------------------------------------ */
export function AnnualBillChart({ projection }) {
  const { rows, risePercent } = projection;
  if (!rows.length) return null;

  const max = Math.max(...rows.map((r) => r.withoutSolar), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  const scaleY = (v) => PLOT.y + PLOT.h - (v / top) * PLOT.h;
  const band = PLOT.w / rows.length;
  const barW = Math.min(13, band / 2 - 2);
  const scaleX = (i) => PLOT.x + band * i + band / 2;

  const last = rows[rows.length - 1];

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <Frame
          ticks={ticks}
          scaleY={scaleY}
          ariaLabel={`Yearly power bill over ${rows.length} years, with and without solar, assuming prices rise ${risePercent}% a year`}
        >
          {rows.map((r, i) => {
            const cx = scaleX(i);
            const h1 = Math.max(0, PLOT.y + PLOT.h - scaleY(r.withoutSolar));
            const h2 = Math.max(0, PLOT.y + PLOT.h - scaleY(r.withSolar));
            return (
              <g key={r.year}>
                <rect
                  x={cx - barW - 1}
                  y={scaleY(r.withoutSolar)}
                  width={barW}
                  height={h1}
                  rx="2"
                  fill={C.without}
                />
                {r.withSolar > 0 && (
                  <rect
                    x={cx + 1}
                    y={scaleY(r.withSolar)}
                    width={barW}
                    height={h2}
                    rx="2"
                    fill={C.withSolar}
                  />
                )}
              </g>
            );
          })}

          {/* Only the last year is labelled — the point is the gap, not 40 numbers. */}
          <text
            x={scaleX(rows.length - 1)}
            y={scaleY(last.withoutSolar) - 7}
            textAnchor="end"
            fontSize="12"
            fontWeight="600"
            fill={C.without}
            fontFamily="ui-monospace, monospace"
          >
            {money0(last.withoutSolar)}
          </text>

          <line
            x1={PLOT.x}
            x2={PLOT.x + PLOT.w}
            y1={PLOT.y + PLOT.h}
            y2={PLOT.y + PLOT.h}
            stroke={C.axis}
            strokeWidth="1"
          />
          <XLabels rows={rows} scaleX={scaleX} />
        </Frame>
      </div>
      <Legend
        items={[
          { label: "Your bill without solar", color: C.without },
          { label: "Your bill with solar", color: C.withSolar },
        ]}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ *
 * 2. What it adds up to
 * ------------------------------------------------------------------ */
export function CumulativeChart({ projection }) {
  const { rows, breakEvenYear } = projection;
  if (!rows.length) return null;

  const max = Math.max(
    ...rows.map((r) => Math.max(r.cumulativeWithout, r.cumulativeWith)),
    1
  );
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  const scaleY = (v) => PLOT.y + PLOT.h - (v / top) * PLOT.h;
  const scaleX = (i) => PLOT.x + (PLOT.w / (rows.length - 1 || 1)) * i;

  const path = (key) => rows.map((r, i) => `${scaleX(i)},${scaleY(r[key])}`).join(" ");

  const last = rows[rows.length - 1];
  const crossIndex = breakEvenYear ? breakEvenYear - 1 : null;

  // Shade only the years the customer is actually ahead — before the crossover
  // the gap runs the other way, and colouring that green would claim a saving
  // that hasn't happened yet.
  const ahead = crossIndex === null ? [] : rows.slice(crossIndex);
  const areaBetween = ahead.length
    ? [
        ...ahead.map((r, i) => `${scaleX(crossIndex + i)},${scaleY(r.cumulativeWithout)}`),
        ...ahead
          .map((r, i) => `${scaleX(crossIndex + i)},${scaleY(r.cumulativeWith)}`)
          .reverse(),
      ].join(" ")
    : null;

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <Frame
          ticks={ticks}
          scaleY={scaleY}
          ariaLabel={`Total spent on power over ${rows.length} years, with and without solar`}
        >
          {areaBetween && <polygon points={areaBetween} fill={C.withSolar} opacity="0.14" />}

          {crossIndex !== null && (
            <g>
              <line
                x1={scaleX(crossIndex)}
                x2={scaleX(crossIndex)}
                y1={PLOT.y}
                y2={PLOT.y + PLOT.h}
                stroke={C.ink}
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              <text
                x={scaleX(crossIndex) + 6}
                y={PLOT.y + 12}
                fontSize="11.5"
                fontWeight="600"
                fill={C.ink}
              >
                Paid for itself — year {breakEvenYear}
              </text>
            </g>
          )}

          <polyline points={path("cumulativeWithout")} fill="none" stroke={C.without} strokeWidth="2.5" />
          <polyline points={path("cumulativeWith")} fill="none" stroke={C.withSolar} strokeWidth="2.5" />

          <circle cx={scaleX(rows.length - 1)} cy={scaleY(last.cumulativeWithout)} r="4" fill={C.without} />
          <circle cx={scaleX(rows.length - 1)} cy={scaleY(last.cumulativeWith)} r="4" fill={C.withSolar} />

          <line
            x1={PLOT.x}
            x2={PLOT.x + PLOT.w}
            y1={PLOT.y + PLOT.h}
            y2={PLOT.y + PLOT.h}
            stroke={C.axis}
            strokeWidth="1"
          />
          <XLabels rows={rows} scaleX={scaleX} />
        </Frame>
      </div>
      <Legend
        items={[
          { label: "Total paid without solar", color: C.without },
          { label: "Total paid with solar (system included)", color: C.withSolar },
        ]}
      />
    </figure>
  );
}
