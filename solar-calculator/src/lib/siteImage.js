/**
 * Getting a picture of the customer's roof onto the proposal.
 *
 * Two paths, because one of them has to work on a rep's phone in a driveway
 * with no account set up:
 *
 *   1. UPLOAD (always available) — the rep picks a photo or a screenshot. Read
 *      as a data URL so it travels with the proposal and needs no hosting.
 *   2. SATELLITE (needs an API key) — a static aerial tile for the typed
 *      address. Google and Mapbox both serve one from a plain <img> URL, so no
 *      SDK and no map widget is needed.
 *
 * The key is read from the build environment and is never bundled unless it is
 * set, so the app ships usable without one. Note that a static-maps key is
 * visible to anyone who loads the page — restrict it by HTTP referrer in the
 * provider console, and never reuse a key that has billing-heavy APIs enabled.
 */

export const PROVIDERS = {
  google: {
    label: "Google Static Maps",
    /** Google geocodes the address for us, so no separate lookup is needed. */
    url: ({ address, key, width, height, zoom }) =>
      `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(
        address
      )}&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=satellite&key=${encodeURIComponent(
        key
      )}`,
  },
  mapbox: {
    label: "Mapbox Static Images",
    /** Mapbox needs coordinates, so this one requires a geocode step first. */
    url: ({ lng, lat, key, width, height, zoom }) =>
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(
        key
      )}`,
  },
};

const env = (name) =>
  (typeof import.meta !== "undefined" && import.meta.env?.[name]) || "";

export const satelliteConfig = () => ({
  provider: env("VITE_MAP_PROVIDER") || "google",
  key: env("VITE_MAP_KEY"),
});

export const satelliteAvailable = () => Boolean(satelliteConfig().key);

/**
 * How the aerial is requested. Exported because the design canvas needs these
 * exact numbers to work out the scale of the tile: Web Mercator imagery has a
 * known ground resolution at a given zoom and latitude, so a fetched aerial
 * knows how many metres wide it is and can draw panels at true size.
 *
 * Zoom 20 puts roughly 120 m across the frame at Australian latitudes — the
 * house and its neighbours, which is what a rep wants to see. Zoom 19 was
 * double that and left the roof too small to lay panels on.
 *
 * `width` is what we ask for in CSS pixels. The `scale=2` / `@2x` retina flag
 * returns twice the pixels covering the SAME ground, so it must never enter
 * the scale calculation.
 */
export const SATELLITE_VIEW = { width: 900, height: 500, zoom: 20 };

/**
 * Build a satellite image URL for an address, or null when it can't be done —
 * no key configured, no address typed, or a provider that needs coordinates
 * we don't have. Callers fall back to upload.
 */
export function satelliteUrlFor(
  address,
  {
    width = SATELLITE_VIEW.width,
    height = SATELLITE_VIEW.height,
    zoom = SATELLITE_VIEW.zoom,
    lat,
    lng,
  } = {}
) {
  const { provider, key } = satelliteConfig();
  const trimmed = (address || "").trim();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  if (!key || (!trimmed && !hasCoords)) return null;

  if (provider === "mapbox") {
    // Mapbox can only centre on coordinates, so it needs the address resolved
    // first — which the autocomplete does.
    return hasCoords
      ? PROVIDERS.mapbox.url({ lng, lat, key, width, height, zoom })
      : null;
  }

  // Coordinates centre the tile far more reliably than a text address, so use
  // them whenever the address lookup gave us any.
  return PROVIDERS.google.url({
    address: hasCoords ? `${lat},${lng}` : trimmed,
    key,
    width,
    height,
    zoom,
  });
}

/** Read a picked file into a data URL so it can be embedded in the proposal. */
export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected"));
    if (!file.type.startsWith("image/")) {
      return reject(new Error("That file isn't an image — pick a photo or a screenshot."));
    }
    // Data URLs are ~33% bigger than the file. Keep proposals shareable.
    if (file.size > 6 * 1024 * 1024) {
      return reject(new Error("That image is over 6 MB — try a smaller one."));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that image. Try another one."));
    reader.readAsDataURL(file);
  });
}

/**
 * Tidy an Australian address for display: collapse whitespace, uppercase the
 * state, and put a comma before the postcode block if the rep didn't.
 */
export function tidyAddress(raw) {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.replace(
    /\b(nsw|vic|qld|sa|wa|tas|nt|act)\b/gi,
    (m) => m.toUpperCase()
  );
}
