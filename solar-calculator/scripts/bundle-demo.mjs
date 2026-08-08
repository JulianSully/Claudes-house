/**
 * Inline the Vite build into one self-contained HTML file for publishing as a
 * demo. No external requests: the CSS and the JS bundle (React, lucide and the
 * app) are both embedded.
 *
 * Output is page *content* only — no doctype/html/head/body wrapper — because
 * the artifact host supplies that skeleton.
 *
 * Usage: node scripts/bundle-demo.mjs [outfile]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distAssets = join(root, "dist", "assets");
const out = process.argv[2] ?? join(root, "dist", "demo.html");

const files = readdirSync(distAssets);
const cssFile = files.find((f) => f.endsWith(".css"));
const jsFile = files.find((f) => f.endsWith(".js"));
if (!cssFile || !jsFile) throw new Error("run `npm run build` first");

const css = readFileSync(join(distAssets, cssFile), "utf8");
// A literal </script> inside a string in the bundle would close the tag early.
const js = readFileSync(join(distAssets, jsFile), "utf8").replace(/<\/script/gi, "<\\/script");

const html = `<title>Solar + Battery Savings Calculator</title>
<style>
${css}

/* The app commits to one visual world — a dark rail against a light
   workspace — so it does not follow the viewer's theme. That makes painting
   the ground explicitly non-optional: an unpainted body would composite over
   whatever ground the host is using and show through around the app. */
html, body {
  background: #f8fafc;
  margin: 0;
  min-height: 100%;
}
#root { isolation: isolate; }
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync(out, html);
console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`);
