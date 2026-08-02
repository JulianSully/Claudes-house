// Inline SVGs — no icon dependency, and the verdict glyphs need to inherit the
// card's colour token exactly.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function ShieldMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 4 5.5v6.2c0 5 3.4 9.2 8 10.3 4.6-1.1 8-5.3 8-10.3V5.5l-8-3Z" fill="currentColor" />
      <path d="m8.4 12.1 2.5 2.5 5.1-5.2" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Likely a scam. */
export function ShieldAlert({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M12 2.8 4.5 5.6v6c0 4.7 3.2 8.7 7.5 9.7 4.3-1 7.5-5 7.5-9.7v-6L12 2.8Z" />
      <path d="M12 8.4v4.3" />
      <path d="M12 16.1h.01" strokeWidth="2.2" />
    </svg>
  );
}

/** Uncertain. */
export function ShieldQuestion({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M12 2.8 4.5 5.6v6c0 4.7 3.2 8.7 7.5 9.7 4.3-1 7.5-5 7.5-9.7v-6L12 2.8Z" />
      <path d="M10.1 9.6a2 2 0 1 1 2.7 1.9c-.6.2-.8.7-.8 1.3v.4" />
      <path d="M12 16.2h.01" strokeWidth="2.2" />
    </svg>
  );
}

/** Looks safe. */
export function ShieldCheck({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M12 2.8 4.5 5.6v6c0 4.7 3.2 8.7 7.5 9.7 4.3-1 7.5-5 7.5-9.7v-6L12 2.8Z" />
      <path d="m8.9 12 2.2 2.2 4-4.4" />
    </svg>
  );
}

export function MessageIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M20.5 12c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.4-.3l-5.1 1.6 1.4-4A6.7 6.7 0 0 1 3.5 12c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
    </svg>
  );
}

export function GlobeIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c2.1 2.3 3.2 5.1 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.1-3.2-8.2S9.9 6.1 12 3.8Z" />
    </svg>
  );
}

export function LockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <rect x="4.5" y="10.2" width="15" height="10" rx="2.2" />
      <path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6" />
    </svg>
  );
}

export function InfoIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11.2v5" />
      <path d="M12 8.1h.01" strokeWidth="2.2" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base} strokeWidth={2.2}>
      <path d="m5 12.6 4.4 4.4L19 7.4" />
    </svg>
  );
}

export function SparkIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7-1.7 5.8-1.7-5.8L4.5 10.7 10.3 9 12 3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
