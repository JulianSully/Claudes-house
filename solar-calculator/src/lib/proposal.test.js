import { describe, it, expect } from "vitest";
import {
  encodeProposal,
  decodeProposal,
  proposalFromLocation,
  PROPOSAL_VERSION,
} from "./proposal";

const sample = () => ({
  version: PROPOSAL_VERSION,
  id: "HLS-20260324-AB12",
  createdAt: "2026-03-24T01:00:00.000Z",
  customer: { name: "O'Brien", address: "12 Kurrajong St, Coffs Harbour NSW 2450" },
  site: { imageSrc: "data:image/png;base64,AAAA", imageKind: "upload", regionLabel: "Sydney / NSW" },
  estimate: { totalSaving: 429.13, newBill: 20.87, paybackYears: 8.4 },
  signature: null,
});

describe("proposal share links", () => {
  it("round-trips through the URL encoding", () => {
    const p = sample();
    const back = decodeProposal(encodeProposal(p));
    expect(back.id).toBe(p.id);
    expect(back.estimate.totalSaving).toBe(429.13);
  });

  it("survives apostrophes and other non-ASCII in an address", () => {
    const p = sample();
    p.customer.address = "3/12 Ó'Brien Straße — Vaucluse NSW 2030";
    const back = decodeProposal(encodeProposal(p));
    expect(back.customer.address).toBe(p.customer.address);
  });

  it("drops the image so the link stays inside URL length limits", () => {
    const p = sample();
    p.site.imageSrc = "data:image/png;base64," + "A".repeat(200000);
    const encoded = encodeProposal(p);
    expect(decodeProposal(encoded).site.imageSrc).toBeNull();
    expect(encoded.length).toBeLessThan(2000);
  });

  it("produces URL-safe output needing no further escaping", () => {
    const encoded = encodeProposal(sample());
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("returns null for junk rather than throwing", () => {
    expect(decodeProposal("not-base64!!")).toBeNull();
    expect(decodeProposal("")).toBeNull();
    expect(decodeProposal(btoa("{}"))).toBeNull();
  });

  it("rejects a proposal written by a future version", () => {
    const p = { ...sample(), version: PROPOSAL_VERSION + 1 };
    expect(decodeProposal(encodeProposal(p))).toBeNull();
  });

  it("reads a proposal out of a location hash", () => {
    const encoded = encodeProposal(sample());
    expect(proposalFromLocation(`#p=${encoded}`).id).toBe("HLS-20260324-AB12");
    expect(proposalFromLocation("#something=else")).toBeNull();
    expect(proposalFromLocation("")).toBeNull();
  });
});
