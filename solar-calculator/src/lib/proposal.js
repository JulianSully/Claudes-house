/**
 * The proposal as DATA, separate from how it is drawn.
 *
 * `buildProposal` turns the live quote into one plain, serialisable object.
 * Everything downstream — the customer screen, the printed PDF, the share
 * link — renders from that object rather than reaching back into React state.
 *
 * That separation is what makes e-signature a later addition rather than a
 * rewrite: a signing service wants a document plus signer details, and this is
 * already that document. The `signature` field is the seam. When the time
 * comes, POST the object to the provider, keep the returned envelope id, and
 * fill in `signature` — no other part of the app needs to change.
 */

import { tidyAddress } from "./siteImage";

export const PROPOSAL_VERSION = 1;

export function buildProposal(q, { now = new Date() } = {}) {
  const r = q.results;

  return {
    version: PROPOSAL_VERSION,
    id: proposalId(now),
    createdAt: now.toISOString(),

    customer: {
      name: (q.customerName || "").trim(),
      // Tidied here rather than in the input, so the rep can type "nsw" at
      // speed and the customer still sees "NSW" on the proposal.
      address: tidyAddress(q.address),
    },

    site: {
      // Data URLs travel with the proposal; a satellite URL does not, which is
      // why the share link drops the image and the PDF keeps it.
      imageSrc: q.siteImage?.src ?? null,
      imageKind: q.siteImage?.kind ?? null,
    },

    system: {
      sizeKw: numeric(q.systemSizeKw),
      batteryKwh: numeric(q.batteryCapacity),
      batteryEfficiencyPercent: numeric(q.batteryEfficiency),
      installedPrice: numeric(q.systemCost),
      productionFactor: numeric(q.productionFactor),
    },

    tariff: {
      supplyChargePerDay: numeric(q.supplyCharge),
      usageCentsPerKwh: numeric(q.usageCharge),
      feedInCentsPerKwh: numeric(q.feedInTariff),
    },

    billing: {
      period: q.billPeriod,
      periodWord: q.periodWord,
      days: q.days,
      currentBill: numeric(q.billAmount),
      dayPercent: numeric(q.dayPercent),
      nightPercent: numeric(q.nightPercent),
    },

    usage: {
      totalKwh: r.totalKwh,
      dayKwh: r.dayKwh,
      nightKwh: r.nightKwh,
    },

    estimate: {
      production: r.systemProduction,
      usedNow: r.selfConsumed,
      storedForNight: r.nightCoveredByBattery,
      soldBack: r.exported,
      batteryLoss: r.batteryLoss,
      stillFromGrid: q.derived.gridDrawn,
      selfSufficiencyPercent: q.derived.selfSufficiency,

      savingUsedNow: r.savingsSelfConsumed,
      savingStored: r.savingsBattery,
      savingSoldBack: r.savingsExport,
      totalSaving: r.totalSavings,
      newBill: r.newBill,
      credit: q.derived.credit,
      savingPercent: r.savingsPercent,

      annualSaving: q.economics.annualSavings,
      paybackYears: q.economics.paybackYears,
      tenYearNet: q.economics.tenYearNet,
    },

    // Stated on the proposal so the customer sees what it rests on.
    assumptions: {
      productionBasis: `${numeric(q.productionFactor)} hours of good sun a day`,
      note:
        "Estimate based on daily averages from the bill supplied. Actual results vary with weather, " +
        "usage habits, roof orientation and shading.",
    },

    // The e-signature seam. Null until a signing service fills it in.
    signature: null,
  };
}

const numeric = (v) => (Number.isFinite(v) ? v : 0);

function proposalId(now) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HLS-${stamp}-${rand}`;
}

/* ------------------------------------------------------------------ *
 * Share links — the proposal encoded into the URL, so a rep can send one
 * without any backend. Unicode-safe base64: btoa alone throws on an
 * apostrophe in a street name.
 * ------------------------------------------------------------------ */

export function encodeProposal(proposal) {
  // Images are megabytes as data URLs and browsers cap URLs well below that,
  // so the link carries the numbers and the PDF carries the picture.
  const { site, ...rest } = proposal;
  const slim = { ...rest, site: { ...site, imageSrc: null } };

  const json = JSON.stringify(slim);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeProposal(encoded) {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed?.version === PROPOSAL_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function shareUrlFor(proposal, base = window.location.href) {
  const url = new URL(base);
  url.hash = `p=${encodeProposal(proposal)}`;
  return url.toString();
}

export function proposalFromLocation(hash = window.location.hash) {
  const match = /[#&]p=([^&]+)/.exec(hash || "");
  return match ? decodeProposal(match[1]) : null;
}
