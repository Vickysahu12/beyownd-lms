// Quick check that JSON-LD can't break out of its <script> tag.
//   node scripts/check-jsonld.mjs            -> unit check of the escaping rule
//   node scripts/check-jsonld.mjs <url>...   -> also checks real rendered pages
// Exits 1 on any failure.
import assert from "node:assert/strict";

// Same rule as serializeJsonLd in src/lib/seo.tsx (kept in sync by the check below).
const serialize = (d) =>
  JSON.stringify(d).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const evil = { name: '</script><script>alert(1)</script>', note: "a\u2028b" };
const out = serialize(evil);
assert.ok(!out.includes("<"), "serialised JSON-LD must not contain '<'");
assert.ok(out.includes("\\u003c/script>"), "'<' must be written as \\u003c");
assert.ok(!out.includes("\u2028"), "U+2028 must be escaped");
assert.deepEqual(JSON.parse(out), evil, "escaped output must still parse to the same data");

// Guard against the original bug coming back: the source must use "\\u003c".
const { readFileSync } = await import("node:fs");
const src = readFileSync(new URL("../src/lib/seo.tsx", import.meta.url), "utf8");
assert.ok(src.includes('.replace(/</g, "\\\\u003c")'), 'seo.tsx must replace "<" with "\\\\u003c"');
console.log("unit: ok");

// Rendered pages: every ld+json block must be '<'-free and valid JSON.
for (const url of process.argv.slice(2)) {
  const html = await (await fetch(url)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length > 0, `${url}: no JSON-LD found`);
  for (const b of blocks) {
    assert.ok(!b.includes("<"), `${url}: JSON-LD contains a raw '<'`);
    JSON.parse(b);
  }
  console.log(`${url}: ${blocks.length} JSON-LD block(s) ok`);
}
