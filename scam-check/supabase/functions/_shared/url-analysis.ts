// Deterministic, offline analysis of a URL.
//
// This runs before we ask the model anything. The point is to hand the model a
// set of *facts* it cannot get wrong — a homograph domain or an embedded
// userinfo trick is a matter of string parsing, not judgement — so its job is
// explaining what's there rather than squinting at a URL and guessing.
//
// Everything here is offline. We never fetch the page: pulling attacker
// controlled HTML into a prompt is a bad trade, and a phishing kit will happily
// serve a bank's real homepage to a datacentre IP anyway.

/** Multi-part public suffixes common enough to matter for "is this the real domain". */
const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.za", "org.za", "co.in", "net.in", "org.in", "co.jp", "or.jp", "ne.jp",
  "com.br", "com.mx", "com.ar", "com.sg", "com.hk", "com.tw", "com.tr",
  "com.cn", "net.cn", "org.cn", "gov.cn",
  "co.kr", "or.kr", "com.pl", "com.ua", "co.il", "com.my", "co.id",
]);

/** TLDs that show up far more often in phishing than in legitimate business. */
const HIGH_RISK_TLDS = new Set([
  "zip", "mov", "top", "xyz", "gq", "cf", "tk", "ml", "ga", "buzz", "click",
  "link", "work", "rest", "country", "kim", "loan", "download", "review",
  "racing", "win", "bid", "stream", "cam", "surf", "quest", "cfd", "sbs",
  "monster", "lol", "beauty", "hair", "skin", "makeup", "mom", "boats",
]);

const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "bl.ink",
  "s.id", "t.ly", "shrtco.de", "clck.ru", "v.gd", "soo.gd",
]);

/**
 * Brands impersonated often enough to be worth naming. `domains` are the real
 * ones — anything that looks close but isn't on the list is the interesting case.
 */
const IMPERSONATED_BRANDS: Array<{ name: string; keywords: string[]; domains: string[] }> = [
  { name: "PayPal", keywords: ["paypal"], domains: ["paypal.com", "paypal.co.uk", "paypal.me"] },
  { name: "Apple", keywords: ["apple", "icloud", "appleid"], domains: ["apple.com", "icloud.com"] },
  { name: "Microsoft", keywords: ["microsoft", "outlook", "office365", "onedrive"], domains: ["microsoft.com", "outlook.com", "office.com", "live.com", "microsoftonline.com"] },
  { name: "Google", keywords: ["google", "gmail"], domains: ["google.com", "gmail.com", "googlemail.com"] },
  { name: "Amazon", keywords: ["amazon"], domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.com.au"] },
  { name: "Netflix", keywords: ["netflix"], domains: ["netflix.com"] },
  { name: "Meta", keywords: ["facebook", "instagram", "whatsapp", "meta"], domains: ["facebook.com", "instagram.com", "whatsapp.com", "meta.com"] },
  { name: "Chase", keywords: ["chase"], domains: ["chase.com"] },
  { name: "Bank of America", keywords: ["bankofamerica", "bofa"], domains: ["bankofamerica.com"] },
  { name: "Wells Fargo", keywords: ["wellsfargo"], domains: ["wellsfargo.com"] },
  { name: "Barclays", keywords: ["barclays"], domains: ["barclays.co.uk", "barclays.com"] },
  { name: "HSBC", keywords: ["hsbc"], domains: ["hsbc.com", "hsbc.co.uk"] },
  { name: "Lloyds", keywords: ["lloyds"], domains: ["lloydsbank.com", "lloydsbank.co.uk"] },
  { name: "NatWest", keywords: ["natwest"], domains: ["natwest.com"] },
  { name: "Santander", keywords: ["santander"], domains: ["santander.co.uk", "santander.com"] },
  { name: "Revolut", keywords: ["revolut"], domains: ["revolut.com"] },
  { name: "Coinbase", keywords: ["coinbase"], domains: ["coinbase.com"] },
  { name: "Binance", keywords: ["binance"], domains: ["binance.com"] },
  { name: "DHL", keywords: ["dhl"], domains: ["dhl.com", "dhl.co.uk"] },
  { name: "FedEx", keywords: ["fedex"], domains: ["fedex.com"] },
  { name: "UPS", keywords: ["ups"], domains: ["ups.com"] },
  { name: "USPS", keywords: ["usps"], domains: ["usps.com"] },
  { name: "Royal Mail", keywords: ["royalmail"], domains: ["royalmail.com"] },
  { name: "HMRC", keywords: ["hmrc"], domains: ["gov.uk"] },
  { name: "IRS", keywords: ["irs"], domains: ["irs.gov"] },
  { name: "eBay", keywords: ["ebay"], domains: ["ebay.com", "ebay.co.uk"] },
  { name: "LinkedIn", keywords: ["linkedin"], domains: ["linkedin.com"] },
  { name: "Steam", keywords: ["steam", "steamcommunity"], domains: ["steampowered.com", "steamcommunity.com"] },
  { name: "Booking.com", keywords: ["booking"], domains: ["booking.com"] },
  { name: "Airbnb", keywords: ["airbnb"], domains: ["airbnb.com", "airbnb.co.uk"] },
];

/** Words that suggest a page is after credentials or money. */
const SENSITIVE_PATH_WORDS = [
  "login", "signin", "sign-in", "verify", "verification", "account", "secure",
  "security", "update", "confirm", "unlock", "suspended", "billing", "payment",
  "wallet", "recover", "password", "authenticate", "webscr", "activate",
];

export type UrlSignal = {
  id: string;
  severity: "high" | "medium" | "low" | "reassuring";
  detail: string;
};

export type UrlAnalysis = {
  ok: boolean;
  error?: string;
  input: string;
  normalized?: string;
  scheme?: string;
  host?: string;
  /** Punycode-decoded host, when it differs from `host`. */
  hostUnicode?: string;
  registrableDomain?: string;
  subdomains?: string[];
  tld?: string;
  path?: string;
  query?: string;
  signals: UrlSignal[];
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      last = tmp;
    }
  }
  return prev[b.length];
}

function splitHost(host: string): { registrable: string; subdomains: string[]; tld: string } {
  const labels = host.split(".");
  if (labels.length < 2) return { registrable: host, subdomains: [], tld: "" };

  const lastTwo = labels.slice(-2).join(".");
  const suffixLabels = MULTI_PART_SUFFIXES.has(lastTwo) && labels.length >= 3 ? 2 : 1;
  const registrableLabels = labels.slice(-(suffixLabels + 1));

  return {
    registrable: registrableLabels.join("."),
    subdomains: labels.slice(0, labels.length - registrableLabels.length),
    tld: labels[labels.length - 1],
  };
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
/** Any non-ASCII character in a hostname — how confusables (Cyrillic а/е/о) arrive. */
const NON_ASCII = /[^\u0000-\u007F]/;

export function analyzeUrl(raw: string): UrlAnalysis {
  const input = raw.trim();
  const signals: UrlSignal[] = [];

  if (!input) return { ok: false, error: "empty", input, signals };

  // People paste "paypal.com/verify" as often as a full URL.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  const candidate = hasScheme ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "unparseable", input, signals };
  }

  const scheme = url.protocol.replace(":", "");
  if (scheme !== "http" && scheme !== "https") {
    return { ok: false, error: "unsupported_scheme", input, signals };
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const query = url.search;

  // Punycode round-trip: URL already encodes IDNs, so decoding tells us whether
  // the "real" host uses non-ASCII characters.
  let hostUnicode: string | undefined;
  if (host.includes("xn--")) {
    try {
      hostUnicode = host
        .split(".")
        .map((label) =>
          label.startsWith("xn--") ? punydecode(label.slice(4)) : label,
        )
        .join(".");
    } catch {
      hostUnicode = undefined;
    }
  }

  // An IP address has no registrable domain — splitting it on dots would
  // produce a nonsense "domain" like "4.11" and poison every check below it.
  const isIpHost = IPV4.test(host) || host.includes(":") || host.startsWith("[");
  const isPunycode = host.includes("xn--");

  const { registrable, subdomains, tld } = isIpHost
    ? { registrable: host, subdomains: [], tld: "" }
    : splitHost(host);

  // --- Structural tricks ------------------------------------------------

  if (scheme === "http") {
    signals.push({
      id: "no_https",
      severity: "medium",
      detail: "The address starts with http:// rather than https://, so anything typed into the page travels unencrypted. Real banks and shops do not do this.",
    });
  }

  if (url.username || url.password) {
    signals.push({
      id: "userinfo",
      severity: "high",
      detail: `The address contains an "@" before the real domain, which hides where the link actually goes. Everything before the @ ("${url.username}") is ignored by the browser; the real destination is ${host}.`,
    });
  }

  if (isIpHost) {
    signals.push({
      id: "ip_host",
      severity: "high",
      detail: `The link points at a raw IP address (${host}) instead of a domain name. Legitimate companies use named domains.`,
    });
  }

  if (isPunycode) {
    signals.push({
      id: "punycode",
      severity: "high",
      detail: hostUnicode
        ? `The domain uses non-English characters that can imitate ordinary letters. It is stored as "${host}" and displays as "${hostUnicode}".`
        : `The domain uses punycode encoding ("${host}"), a common way to build a domain that looks like a familiar one.`,
    });
  } else if (NON_ASCII.test(url.hostname)) {
    signals.push({
      id: "mixed_script",
      severity: "high",
      detail: "The domain mixes character sets, which is how lookalike domains are built.",
    });
  }

  if (url.port) {
    signals.push({
      id: "nonstandard_port",
      severity: "medium",
      detail: `The link specifies port ${url.port}. Ordinary consumer websites do not need this.`,
    });
  }

  if (subdomains.length >= 3) {
    signals.push({
      id: "deep_subdomains",
      severity: "medium",
      detail: `The address is padded with ${subdomains.length} subdomain levels (${subdomains.join(".")}), which pushes the real domain "${registrable}" off the end of a phone screen.`,
    });
  }

  // Skipped for punycode: "xn--pypal-4ve" is full of hyphens by encoding, not by
  // intent, and the punycode signal above already covers it.
  const hyphens = isPunycode ? 0 : (registrable.split(".")[0].match(/-/g) ?? []).length;
  if (hyphens >= 2) {
    signals.push({
      id: "many_hyphens",
      severity: "medium",
      detail: `The domain "${registrable}" is stitched together with ${hyphens} hyphens, a pattern common in throwaway phishing domains.`,
    });
  }

  if (HIGH_RISK_TLDS.has(tld)) {
    signals.push({
      id: "risky_tld",
      severity: "medium",
      detail: `The address ends in .${tld}, an ending that is cheap to register and heavily over-represented in scams.`,
    });
  }

  if (URL_SHORTENERS.has(registrable)) {
    signals.push({
      id: "shortener",
      severity: "medium",
      detail: `This is a shortened link (${registrable}), so the real destination is hidden until you tap it.`,
    });
  }

  const digitRatio = (host.match(/\d/g) ?? []).length / Math.max(host.length, 1);
  if (!isIpHost && digitRatio > 0.25) {
    signals.push({
      id: "digit_heavy",
      severity: "low",
      detail: "The domain is unusually full of digits, which is typical of automatically generated addresses.",
    });
  }

  if (host.length > 40) {
    signals.push({
      id: "long_host",
      severity: "low",
      detail: `The domain is ${host.length} characters long — unusually long for a real company.`,
    });
  }

  // --- Brand impersonation ---------------------------------------------

  const registrableRoot = registrable.split(".")[0];
  const haystack = `${subdomains.join(".")}.${registrableRoot}`.toLowerCase();
  const pathHaystack = `${path}${query}`.toLowerCase();

  for (const brand of IMPERSONATED_BRANDS) {
    const isRealDomain = brand.domains.some((d) => registrable === d || host === d || host.endsWith(`.${d}`));
    if (isRealDomain) {
      signals.push({
        id: "brand_match",
        severity: "reassuring",
        detail: `The domain "${registrable}" is ${brand.name}'s genuine address.`,
      });
      break;
    }

    const inHost = brand.keywords.some((k) => haystack.includes(k));
    if (inHost) {
      signals.push({
        id: "brand_in_wrong_place",
        severity: "high",
        detail: `The address mentions ${brand.name}, but the domain it actually belongs to is "${registrable}" — not ${brand.name}'s. Anything before the final domain can be set to whatever the sender likes.`,
      });
      break;
    }

    const nearMiss = brand.domains.find((d) => {
      const dist = levenshtein(registrable, d);
      return dist > 0 && dist <= 2 && Math.abs(registrable.length - d.length) <= 2;
    });
    if (nearMiss) {
      signals.push({
        id: "lookalike_domain",
        severity: "high",
        detail: `"${registrable}" is one or two characters away from ${brand.name}'s real address, "${nearMiss}".`,
      });
      break;
    }

    if (brand.keywords.some((k) => pathHaystack.includes(k))) {
      signals.push({
        id: "brand_in_path",
        severity: "medium",
        detail: `The page path mentions ${brand.name}, but the site itself is "${registrable}", which has nothing to do with ${brand.name}.`,
      });
      break;
    }
  }

  // --- What the page is asking for -------------------------------------

  const sensitiveHits = SENSITIVE_PATH_WORDS.filter((w) => pathHaystack.includes(w));
  if (sensitiveHits.length > 0) {
    signals.push({
      id: "sensitive_path",
      severity: "low",
      detail: `The link goes straight to a page about "${sensitiveHits.slice(0, 3).join('", "')}" — the kind of page that asks for a password or card details.`,
    });
  }

  if (path.length > 80) {
    signals.push({
      id: "long_path",
      severity: "low",
      detail: "The link carries a very long trailing string, often used to identify and track the specific person who was sent it.",
    });
  }

  return {
    ok: true,
    input,
    normalized: url.toString(),
    scheme,
    host,
    hostUnicode,
    registrableDomain: registrable,
    subdomains,
    tld,
    path,
    query,
    signals,
  };
}

/** Minimal punycode decoder (RFC 3492), enough to render an IDN host for display. */
function punydecode(input: string): string {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128;
  const delimiter = "-";

  let output: number[] = [];
  let basic = input.lastIndexOf(delimiter);
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j++) output.push(input.charCodeAt(j));

  let n = initialN, bias = initialBias, i = 0;
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length;) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      const code = input.charCodeAt(index++);
      let digit: number;
      if (code >= 0x30 && code <= 0x39) digit = code - 0x30 + 26;
      else if (code >= 0x61 && code <= 0x7a) digit = code - 0x61;
      else if (code >= 0x41 && code <= 0x5a) digit = code - 0x41;
      else throw new Error("bad punycode");
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    const out = output.length + 1;
    let delta = i - oldi;
    delta = oldi === 0 ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / out);
    let k = 0;
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    bias = Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}
