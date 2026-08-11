/**
 * Panel catalogue.
 *
 * Picking a panel sets three things at once: the wattage that drives the system
 * size, the physical proportions the array is drawn at, and the name that goes
 * on the proposal. "18 × Jinko Tiger Neo 440 W" reads like a quote; "18 panels"
 * reads like a guess.
 *
 * THE SPECS BELOW ARE INDICATIVE STARTING POINTS, not datasheets. Manufacturers
 * revise models constantly and the same model name ships at several wattages.
 * Wattage stays editable for exactly that reason — check the actual datasheet
 * for the stock being quoted before it goes to a customer.
 *
 * Dimensions are the module's long and short side in millimetres. Only their
 * ratio is used for drawing, so a panel being 10 mm out changes nothing that
 * matters; the wattage is the number worth getting right.
 */

export const PANELS = [
  { id: "trina-vertex-s-440", brand: "Trina Solar", model: "Vertex S+ 440", watts: 440, longMm: 1762, shortMm: 1134 },
  { id: "jinko-tiger-neo-440", brand: "Jinko Solar", model: "Tiger Neo 440", watts: 440, longMm: 1762, shortMm: 1134 },
  { id: "longi-himo6-440", brand: "LONGi", model: "Hi-MO 6 440", watts: 440, longMm: 1722, shortMm: 1134 },
  { id: "aiko-neostar-445", brand: "Aiko", model: "Neostar 2S 445", watts: 445, longMm: 1722, shortMm: 1134 },
  { id: "canadian-tophiku6-445", brand: "Canadian Solar", model: "TOPHiKu6 445", watts: 445, longMm: 1762, shortMm: 1134 },
  { id: "rec-alpha-pure-rx-450", brand: "REC", model: "Alpha Pure-RX 450", watts: 450, longMm: 1730, shortMm: 1118 },
  { id: "qcells-ml-g11-410", brand: "Q CELLS", model: "Q.PEAK DUO ML-G11 410", watts: 410, longMm: 1879, shortMm: 1045 },
  { id: "maxeon-6-440", brand: "Maxeon", model: "Maxeon 6 440", watts: 440, longMm: 1872, shortMm: 1032 },
  { id: "tindo-karra-440", brand: "Tindo", model: "Karra 440", watts: 440, longMm: 1762, shortMm: 1134 },
  { id: "custom", brand: "Other", model: "Custom panel", watts: 440, longMm: 1762, shortMm: 1134 },
];

export const DEFAULT_PANEL_ID = "trina-vertex-s-440";

export const panelById = (id) => PANELS.find((p) => p.id === id) ?? PANELS[0];

export const panelLabel = (p) =>
  p.id === "custom" ? "Custom panel" : `${p.brand} ${p.model}`;

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
