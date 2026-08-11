/**
 * The quote the app opens with.
 *
 * A blank form is a bad first impression and a bad demo — a rep showing this to
 * a colleague, or to themselves for the first time, should land on a finished
 * example rather than an empty shell. Every field here is editable the moment
 * they start typing over it.
 *
 * The sample property is Moura, in central Queensland. Coordinates come off the
 * aerial the image was captured from, so with a maps key configured the
 * "Aerial view" button re-fetches the same roof rather than guessing from the
 * address text.
 */

export const DEFAULT_CUSTOMER = {
  name: "Billy Bob",
  address: "29 Elliott Street, Moura QLD 4718",
  lat: -24.5803,
  lng: 149.97788,
};

/**
 * Served from `public/`, so a missing file degrades to "no image yet" instead
 * of failing the build — which an `import` of a missing asset would do.
 *
 * To swap the sample property: drop a new image at this path and update
 * DEFAULT_CUSTOMER above. The demo bundler inlines whatever is here as a data
 * URI so the single-file build stays self-contained.
 */
// BASE_URL always ends in a slash, so this needs no tidying up afterwards.
// It must not: the demo bundler rewrites this path to an inlined data URI, and
// base64 is full of "//" — a blind slash-collapse would corrupt the image.
export const DEFAULT_SITE_IMAGE = `${import.meta.env?.BASE_URL ?? "/"}site-default.jpg`;

/** Aspect ratio of the bundled image, so the design canvas is right on load. */
export const DEFAULT_SITE_ASPECT = 1720 / 1074;

/**
 * How much ground the sample image covers, in metres per viewBox unit — the
 * canvas is 1000 units wide, so this frame is about 92 m across.
 *
 * It is an ESTIMATE — the file is a screenshot and carries no zoom level with
 * it — but a checkable one: at this scale the panels drawn on the roof come out
 * the same size as the real array already installed on the house at the top of
 * the frame, and the street reads about 9 m kerb to kerb. An aerial fetched
 * through the Aerial view button gets its scale computed exactly instead. If a
 * panel still looks wrong here, redo the scale on the Design tab — one drag
 * across the driveway fixes it.
 */
export const DEFAULT_SITE_SCALE = 0.092; // metres per viewBox unit
