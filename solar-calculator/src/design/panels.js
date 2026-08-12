/**
 * Panel catalogue.
 *
 * Picking a panel sets three things at once: the wattage that drives the system
 * size, the physical size the array is drawn at, and the name that goes on the
 * proposal. "18 × Jinko Tiger Neo 440 W" reads like a quote; "18 panels" reads
 * like a guess.
 *
 * THE SPECS BELOW ARE INDICATIVE STARTING POINTS, not datasheets. Manufacturers
 * revise models constantly and the same product line ships at half a dozen
 * wattages and more than one physical size. Everything here is editable for
 * exactly that reason — check the actual datasheet for the stock being quoted
 * before it goes to a customer, and correct the entry if it is off.
 *
 * This is a starting list of what gets installed on Australian roofs, not a
 * complete register of every module ever certified. Anything missing goes in as
 * a custom panel — brand, model, wattage and size are all typed in — and can be
 * starred as a favourite so it is one tap away on the next job.
 */

const M = (id, brand, model, watts, longMm, shortMm) => ({
  id,
  brand,
  model,
  watts,
  longMm,
  shortMm,
});

export const PANELS = [
  // Trina
  M("trina-vertex-s-plus-440", "Trina Solar", "Vertex S+ 440", 440, 1762, 1134),
  M("trina-vertex-s-plus-450", "Trina Solar", "Vertex S+ 450", 450, 1762, 1134),
  M("trina-vertex-s-425", "Trina Solar", "Vertex S 425", 425, 1762, 1134),

  // Jinko
  M("jinko-tiger-neo-440", "Jinko Solar", "Tiger Neo 440", 440, 1762, 1134),
  M("jinko-tiger-neo-460", "Jinko Solar", "Tiger Neo 460", 460, 1762, 1134),
  M("jinko-tiger-pro-415", "Jinko Solar", "Tiger Pro 415", 415, 1722, 1134),

  // LONGi
  M("longi-himo6-440", "LONGi", "Hi-MO 6 440", 440, 1722, 1134),
  M("longi-himo6-450", "LONGi", "Hi-MO 6 450", 450, 1722, 1134),
  M("longi-himox6-440", "LONGi", "Hi-MO X6 440", 440, 1722, 1134),
  M("longi-himo5-410", "LONGi", "Hi-MO 5 410", 410, 1722, 1134),

  // JA Solar
  M("ja-deepblue4-440", "JA Solar", "DeepBlue 4.0 440", 440, 1762, 1134),
  M("ja-deepblue3-415", "JA Solar", "DeepBlue 3.0 415", 415, 1722, 1134),

  // Canadian Solar
  M("canadian-tophiku6-445", "Canadian Solar", "TOPHiKu6 445", 445, 1762, 1134),
  M("canadian-hiku6-420", "Canadian Solar", "HiKu6 420", 420, 1722, 1134),

  // Aiko
  M("aiko-neostar-2s-445", "Aiko", "Neostar 2S 445", 445, 1722, 1134),
  M("aiko-neostar-2s-460", "Aiko", "Neostar 2S 460", 460, 1722, 1134),

  // REC
  M("rec-alpha-pure-rx-450", "REC", "Alpha Pure-RX 450", 450, 1730, 1118),
  M("rec-alpha-pure-r-430", "REC", "Alpha Pure-R 430", 430, 1730, 1118),

  // Q CELLS
  M("qcells-ml-g11-410", "Q CELLS", "Q.PEAK DUO ML-G11 410", 410, 1879, 1045),
  M("qcells-ml-g10-400", "Q CELLS", "Q.PEAK DUO ML-G10+ 400", 400, 1879, 1045),
  M("qcells-qtron-430", "Q CELLS", "Q.TRON BLK M-G2+ 430", 430, 1879, 1045),

  // Maxeon / SunPower
  M("maxeon-6-440", "Maxeon", "Maxeon 6 440", 440, 1872, 1032),
  M("maxeon-7-445", "Maxeon", "Maxeon 7 445", 445, 1810, 1046),
  M("sunpower-performance6-435", "SunPower", "Performance 6 435", 435, 1812, 1096),

  // Risen
  M("risen-titan-410", "Risen Energy", "Titan 410", 410, 1722, 1134),
  M("risen-hyperion-440", "Risen Energy", "Hyper-ion 440", 440, 1762, 1134),

  // Astronergy
  M("astronergy-astro-n5-440", "Astronergy", "Astro N5 440", 440, 1762, 1134),

  // Suntech
  M("suntech-ultra-v-420", "Suntech", "Ultra V 420", 420, 1722, 1134),

  // Winaico
  M("winaico-gemini-440", "Winaico", "WST-NGX Gemini 440", 440, 1722, 1134),

  // Phono
  M("phono-draco-435", "Phono Solar", "Draco N-type 435", 435, 1722, 1134),

  // Hyundai
  M("hyundai-hie-s-410", "Hyundai", "HiE-S 410", 410, 1719, 1140),

  // Seraphim
  M("seraphim-s4-410", "Seraphim", "S4 Blade 410", 410, 1722, 1134),

  // Solarwatt
  M("solarwatt-vision-425", "Solarwatt", "Panel vision 425", 425, 1767, 1041),

  // Tindo — made in Adelaide, so it comes up on price-versus-local jobs.
  M("tindo-karra-440", "Tindo", "Karra 440", 440, 1762, 1134),

  // Always last: whatever is actually on the truck.
  M("custom", "Other", "Custom panel", 440, 1762, 1134),
];

export const DEFAULT_PANEL_ID = "trina-vertex-s-plus-440";
export const CUSTOM_PANEL_ID = "custom";

export const panelById = (id) => PANELS.find((p) => p.id === id) ?? PANELS[0];

export const panelLabel = (p) =>
  p.id === CUSTOM_PANEL_ID ? "Custom panel" : `${p.brand} ${p.model}`;

/**
 * Short side over long side. Multiplying the on-photo length of a panel's long
 * edge by this gives its short edge, whichever way round it is mounted.
 */
export const panelRatio = (p) => p.shortMm / p.longMm;

/**
 * Panels go on a roof either way up, and it changes how many fit where — so it
 * is a real choice, not decoration.
 */
export const ORIENTATIONS = [
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
];

/** Brands, in the order they first appear, for the filter row. */
export const BRANDS = [...new Set(PANELS.filter((p) => p.id !== CUSTOM_PANEL_ID).map((p) => p.brand))];

/**
 * Loose search across brand, model and wattage, so "jinko 440", "440" and
 * "tiger" all land somewhere sensible. Every term has to match somewhere,
 * which is what makes typing two words narrow rather than widen the list.
 */
export function searchPanels(query, list = PANELS) {
  const terms = String(query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return list;

  return list.filter((p) => {
    const haystack = `${p.brand} ${p.model} ${p.watts}w`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/* ------------------------------------------------------------------ *
 * Favourites.
 *
 * A rep sells the same three or four panels all year. Making them scroll a
 * catalogue every time is the thing that wastes the minute. Stored on the
 * device — there is no account to hang them off — and every read is guarded,
 * because private browsing and file:// pages both throw on localStorage.
 * ------------------------------------------------------------------ */

const FAVOURITES_KEY = "helios.panels.favourites";

export function loadFavourites() {
  try {
    const raw = window.localStorage.getItem(FAVOURITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveFavourites(ids) {
  try {
    window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(ids));
  } catch {
    // Nothing to do — favourites are a convenience, not state the app needs.
  }
}

export const toggleFavourite = (ids, id) =>
  ids.includes(id) ? ids.filter((f) => f !== id) : [...ids, id];

/** Favourites first, then the rest in catalogue order. */
export function orderByFavourites(list, favourites) {
  const starred = new Set(favourites);
  return [...list].sort((a, b) => (starred.has(b.id) ? 1 : 0) - (starred.has(a.id) ? 1 : 0));
}
