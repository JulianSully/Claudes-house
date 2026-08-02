import { SparkIcon } from "./icons";

/** Compact "how many checks are left" readout. Hidden entirely for paid users
 *  except as a quiet confirmation that the limit no longer applies. */
export default function UsageMeter({ usage }) {
  if (!usage) return null;

  if (usage.plan === "pro") {
    return (
      <p className="usage">
        <span className="usage__unlimited">
          <SparkIcon />
          Unlimited checks
        </span>
      </p>
    );
  }

  const limit = usage.limit ?? 5;
  const used = Math.min(usage.used ?? 0, limit);
  const remaining = Math.max(limit - used, 0);

  return (
    <p className="usage">
      <span className="usage__pips" aria-hidden="true">
        {Array.from({ length: limit }, (_, i) => (
          <span
            key={i}
            className={
              "usage__pip" +
              (i < used ? " usage__pip--used" : "") +
              (i === used && remaining === 1 ? " usage__pip--last" : "")
            }
          />
        ))}
      </span>
      <span>
        {remaining === 0
          ? "No free checks left this month"
          : `${remaining} of ${limit} free ${remaining === 1 ? "check" : "checks"} left this month`}
      </span>
    </p>
  );
}
