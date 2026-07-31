export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** Human-readable trust line, e.g. "Verified by 18 people in the last 90 days". */
export function verificationLabel(confirmations: number): string {
  if (!confirmations) return "Not yet verified by the community";
  if (confirmations === 1) return "Verified by 1 person in the last 90 days";
  return `Verified by ${confirmations} people in the last 90 days`;
}

export function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not reported";
}

export function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(1);
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "Not reported";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
