/**
 * Where the household's power comes from, as one donut.
 *
 * The three slices add up to everything the home uses, which is the story a
 * customer follows: most of it now comes from their own roof, and the grey
 * remainder is all they still buy. Every slice is directly labelled, so the
 * chart never depends on colour alone to be read.
 */
export default function EnergyDonut({ segments, size = 200, thickness = 26 }) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const visible = segments.filter((s) => s.value > 0.0001);

  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 && visible.length > 1 ? 2 : 0; // px of surface between slices

  let offset = 0;
  const arcs = visible.map((s) => {
    const fraction = s.value / total;
    const length = Math.max(0, fraction * circumference - gap);
    const arc = {
      ...s,
      dash: `${length} ${circumference - length}`,
      offset: -offset,
      percent: fraction * 100,
    };
    offset += fraction * circumference;
    return arc;
  });

  const headline = visible.length
    ? Math.round(
        (visible
          .filter((s) => !s.isGrid)
          .reduce((a, s) => a + s.value, 0) /
          total) *
          100
      )
    : 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${headline}% of your power comes from your own system`}
        >
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={thickness}
            />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={thickness}
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                strokeLinecap="butt"
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          {/* Kept inside the ring's inner diameter so the label never spills
              over the stroke — the hole is (size − 2 × thickness) wide. */}
          <div style={{ maxWidth: size - thickness * 2 - 16 }}>
            <div className="font-mono text-[28px] font-semibold leading-none tabular-nums text-slate-900">
              {headline}%
            </div>
            <div className="mt-1 text-[10.5px] leading-tight text-slate-500">
              from your own system
            </div>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-baseline gap-2.5">
            <span
              className="mt-1 h-3 w-3 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] leading-snug text-slate-700">{s.label}</span>
              {s.sub && <span className="block text-[11.5px] text-slate-500">{s.sub}</span>}
            </span>
            <span className="shrink-0 font-mono text-[13.5px] font-semibold tabular-nums text-slate-900">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
