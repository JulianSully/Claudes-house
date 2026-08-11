/**
 * Type an address, pick it from a list, get the roof on screen.
 *
 * Two providers, both keyed, plus a keyless fallback so the interaction is
 * still visible before anyone has signed up for anything:
 *
 *   google  — Places Autocomplete (New) for the suggestions, then a Place
 *             lookup for coordinates. Best Australian address coverage.
 *   mapbox  — Geocoding v5, which returns coordinates with the suggestion, so
 *             it needs one request rather than two.
 *   sample  — a short built-in list, clearly labelled. No network, no key. It
 *             exists so the flow can be demonstrated, and it NEVER pretends to
 *             have found a real property: picking one fills the address and
 *             asks for a photo, because inventing aerial imagery for a real
 *             street would be worse than admitting there is none.
 *
 * A browser-visible key is unavoidable here. Restrict it by HTTP referrer in
 * the provider's console and enable only the APIs below on it.
 */

import { DEFAULT_CUSTOMER } from "./defaults";

const env = (name) =>
  (typeof import.meta !== "undefined" && import.meta.env?.[name]) || "";

export const addressConfig = () => ({
  provider: env("VITE_MAP_PROVIDER") || "google",
  key: env("VITE_MAP_KEY"),
});

export const liveSearchAvailable = () => Boolean(addressConfig().key);

/* ------------------------------------------------------------------ *
 * Sample addresses — demo only, and labelled as such wherever shown.
 * ------------------------------------------------------------------ */
const SAMPLES = [
  // The sample property the app opens with, so re-picking it restores the
  // coordinates the bundled aerial was captured at.
  {
    label: DEFAULT_CUSTOMER.address,
    lat: DEFAULT_CUSTOMER.lat,
    lng: DEFAULT_CUSTOMER.lng,
  },
  "12 Kurrajong Street, Coffs Harbour NSW 2450",
  "8 Banksia Avenue, Frankston VIC 3199",
  "45 Jacaranda Drive, Springfield Lakes QLD 4300",
  "3 Wattle Court, Golden Grove SA 5125",
  "27 Karri Loop, Baldivis WA 6171",
  "6 Melaleuca Way, Howrah TAS 7018",
  "19 Bottlebrush Crescent, Palmerston NT 0830",
  "51 Grevillea Place, Gungahlin ACT 2912",
  "104 Eucalypt Road, Port Macquarie NSW 2444",
  "7 Casuarina Street, Bunbury WA 6230",
];

const sampleSearch = (query) => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return SAMPLES.map((s) => (typeof s === "string" ? { label: s } : s))
    .filter((s) => s.label.toLowerCase().includes(q))
    .slice(0, 6)
    .map((s, i) => ({
      id: `sample-${i}-${s.label}`,
      label: s.label,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      provider: "sample",
    }));
};

/* ------------------------------------------------------------------ *
 * Providers
 * ------------------------------------------------------------------ */

async function googleSearch(query, key, signal) {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: ["au"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    }),
  });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
  const data = await res.json();
  return (data.suggestions ?? [])
    .filter((s) => s.placePrediction)
    .map((s) => ({
      id: s.placePrediction.placeId,
      label: s.placePrediction.text?.text ?? "",
      provider: "google",
    }));
}

async function googleResolve(item, key, signal) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(item.id)}?fields=formattedAddress,location`,
    { signal, headers: { "X-Goog-Api-Key": key } }
  );
  if (!res.ok) throw new Error(`Couldn't look up that address (${res.status})`);
  const data = await res.json();
  return {
    address: data.formattedAddress ?? item.label,
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  };
}

async function mapboxSearch(query, key, signal) {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?country=au&types=address&limit=6&access_token=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
  const data = await res.json();
  return (data.features ?? []).map((f) => ({
    id: f.id,
    label: f.place_name,
    // Mapbox hands back coordinates with the suggestion, so no second call.
    lat: f.center?.[1] ?? null,
    lng: f.center?.[0] ?? null,
    provider: "mapbox",
  }));
}

/**
 * Suggestions for a partial address. Returns `{ items, mode }` where mode is
 * "live" or "sample", so the UI can be honest about which it is showing.
 * Never throws for an aborted request — that is just the next keystroke.
 */
export async function searchAddresses(query, { signal } = {}) {
  const { provider, key } = addressConfig();
  const q = (query ?? "").trim();
  if (q.length < 3) return { items: [], mode: key ? "live" : "sample" };

  if (!key) return { items: sampleSearch(q), mode: "sample" };

  try {
    const items =
      provider === "mapbox"
        ? await mapboxSearch(q, key, signal)
        : await googleSearch(q, key, signal);
    return { items, mode: "live" };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    // A dead lookup should not block a rep who can type the address anyway.
    return { items: [], mode: "live", error: err.message };
  }
}

/** Turn a chosen suggestion into an address plus coordinates, where available. */
export async function resolveAddress(item, { signal } = {}) {
  const { provider, key } = addressConfig();
  if (!item) return null;
  if (item.provider === "sample" || !key) {
    return { address: item.label, lat: item.lat ?? null, lng: item.lng ?? null };
  }
  if (provider === "mapbox" || item.lat != null) {
    return { address: item.label, lat: item.lat ?? null, lng: item.lng ?? null };
  }
  return googleResolve(item, key, signal);
}
