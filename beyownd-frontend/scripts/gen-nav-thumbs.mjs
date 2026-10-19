// Generates the small navigation-dropdown tiles into public/illustrations/:
// Beyownd's three documents and generic program covers (used when a course
// has no thumbnailUrl yet).
// Run: node scripts/gen-nav-thumbs.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "illustrations");
mkdirSync(out, { recursive: true });

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n) => Math.round(n * 10) / 10;

const bg = (a, b) =>
  `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shadow = `<filter id="ps" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#183a5a" flood-opacity="0.22"/></filter>`;
const tile = (a, b, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 168" width="240" height="168"><defs>${bg(a, b)}${shadow}</defs><rect width="240" height="168" fill="url(#bg)"/>${body}</svg>`;

const lines = (x, y, widths, gap = 9, color = "#d9dee5") =>
  widths.map((w, i) => `<rect x="${x}" y="${y + i * gap}" width="${w}" height="3.2" rx="1.6" fill="${color}"/>`).join("");

// The Beyownd mark (same paths as src/components/brand/logo.tsx), scaled into an s×s box.
const mark = (x, y, s = 14) => {
  const k = s / 64;
  return `<g transform="translate(${x} ${y}) scale(${r1(k * 1000) / 1000})"><g transform="translate(2 -3.6) scale(1 1.13)">
<path d="M14 13.5a3.5 3.5 0 0 1 3.5-3.5H24v15.2l13.6 7.3a1.4 1.4 0 0 1 0 2.5L19.5 50.6A3.6 3.6 0 0 1 14 47.6z" fill="#1c3260"/>
<path d="M24 31.6v9.4l8.4-4.7z" fill="#fffdf8"/>
<path d="M26.5 10.5l23.6 19.7a2.3 2.3 0 0 1 0 3.5L33.6 47.6a2.6 2.6 0 0 1-3.9-3.3l11.1-11.1a1.5 1.5 0 0 0 0-2.1z" fill="#ec2a2f"/>
</g></g>`;
};

function qr(x, y, size, seed) {
  const rand = rng(seed);
  const n = 9;
  const c = size / n;
  let svg = `<rect x="${x - 3}" y="${y - 3}" width="${size + 6}" height="${size + 6}" rx="3" fill="#fff"/>`;
  const finder = (i, j) => (i < 3 && j < 3) || (i < 3 && j > 5) || (i > 5 && j < 3);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const fi = i % 6;
      const fj = j > 5 ? j - 6 : j;
      const on = finder(i, j) ? !(fi === 1 && fj === 1) : rand() > 0.5;
      if (on) svg += `<rect x="${r1(x + j * c)}" y="${r1(y + i * c)}" width="${r1(c)}" height="${r1(c)}" fill="#0e0f12"/>`;
    }
  return svg;
}

const win = (inner) => `<g filter="url(#ps)">
<rect x="34" y="26" width="172" height="122" rx="8" fill="#fff"/>
<path d="M42 26h156a8 8 0 0 1 8 8v8H34v-8a8 8 0 0 1 8-8z" fill="#f2f5f8"/>
<circle cx="44" cy="34" r="2.5" fill="#d5dbe2"/><circle cx="52" cy="34" r="2.5" fill="#d5dbe2"/><circle cx="60" cy="34" r="2.5" fill="#d5dbe2"/>
${inner}</g>`;

const files = {
  "doc-offer.svg": tile(
    "#d9f0fc",
    "#9ad6f7",
    `<g transform="rotate(-4 120 100)" filter="url(#ps)">
<rect x="62" y="22" width="116" height="160" rx="6" fill="#fffdf8"/>
${mark(74, 34)}<rect x="94" y="37" width="40" height="4" rx="2" fill="#0e0f12"/><rect x="94" y="44" width="28" height="3" rx="1.5" fill="#b9c2cc"/>
<rect x="74" y="62" width="62" height="6" rx="3" fill="#183a5a"/>
${lines(74, 76, [92, 86, 90, 70, 88, 60])}
<path d="M76 140c8-10 12 6 18-2s10-8 14 0" stroke="#183a5a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<rect x="74" y="148" width="40" height="2.6" rx="1.3" fill="#c9d0d8"/>
</g>`,
  ),
  "doc-certificate.svg": tile(
    "#fff5d2",
    "#ffd54a",
    `<g transform="rotate(3 120 92)" filter="url(#ps)">
<rect x="28" y="30" width="184" height="124" rx="6" fill="#fffdf8"/>
<rect x="35" y="37" width="170" height="110" rx="4" fill="none" stroke="#e3c46a" stroke-width="1.4"/>
<rect x="39" y="41" width="162" height="102" rx="3" fill="none" stroke="#f1dfa6" stroke-width="0.8"/>
${mark(112, 48, 16)}
<rect x="78" y="72" width="84" height="5" rx="2.5" fill="#0e0f12"/>
<rect x="92" y="83" width="56" height="7" rx="3.5" fill="#7b61ff"/>
${lines(70, 98, [100, 76], 8)}
<path d="M62 134l-4 12 6-3 3 5 2-12zM74 134l4 12-6-3-3 5-2-12z" fill="#7b61ff"/>
<circle cx="68" cy="128" r="10" fill="#ffd54a" stroke="#e3b42c" stroke-width="1.4"/><circle cx="68" cy="128" r="5.5" fill="none" stroke="#e3b42c" stroke-width="1"/>
${qr(170, 112, 27, 7)}
</g>`,
  ),
  "doc-letter.svg": tile(
    "#e7f7ef",
    "#bfe9d3",
    `<g transform="rotate(-3 120 100)" filter="url(#ps)">
<rect x="62" y="22" width="116" height="160" rx="6" fill="#fffdf8"/>
${mark(74, 34)}<rect x="94" y="37" width="40" height="4" rx="2" fill="#0e0f12"/>
<rect x="74" y="58" width="54" height="5" rx="2.5" fill="#0e0f12"/>
${lines(74, 72, [92, 88, 92, 84, 90, 66, 86])}
<g transform="rotate(-12 150 142)"><circle cx="150" cy="142" r="17" fill="#fffdf8" stroke="#1fa971" stroke-width="2.2"/><path d="M142 142l6 6 10-11" stroke="#1fa971" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
</g>`,
  ),
  "cover-web.svg": tile(
    "#5dbbf0",
    "#d9f0fc",
    win(`<text x="48" y="68" font-family="monospace" font-size="16" font-weight="700" fill="#7b61ff">&lt;/&gt;</text>
${lines(84, 58, [70, 50], 9, "#183a5a")}
${lines(48, 84, [40, 104, 72], 10, "#cfd8e2")}
<rect x="48" y="118" width="46" height="14" rx="7" fill="#0e0f12"/><rect x="100" y="118" width="40" height="14" rx="7" fill="#ffd54a"/>`),
  ),
  "cover-data.svg": tile(
    "#7b61ff",
    "#cbbfff",
    win(
      [30, 46, 38, 62, 52, 76]
        .map(
          (h, i) =>
            `<rect x="${52 + i * 22}" y="${138 - h}" width="13" height="${h}" rx="3" fill="${i === 5 ? "#ffd54a" : "#183a5a"}" opacity="${i === 5 ? 1 : r1(0.2 + i * 0.12)}"/>`,
        )
        .join("") +
        `<path d="M58 96L80 84L102 92L124 68L146 76L168 52" stroke="#7b61ff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  ),
  "cover-design.svg": tile(
    "#ffb547",
    "#ffe7a8",
    win(`<circle cx="80" cy="90" r="24" fill="#7b61ff" opacity="0.9"/><rect x="102" y="68" width="44" height="44" rx="10" fill="#5dbbf0"/>
<path d="M152 122l20-34 20 34z" fill="#ffd54a" stroke="#e3a92c" stroke-width="1"/>
<rect x="48" y="128" width="60" height="5" rx="2.5" fill="#cfd8e2"/>`),
  ),
  "cover-mobile.svg": tile(
    "#1fa971",
    "#c8f0dc",
    `<g filter="url(#ps)"><rect x="89" y="16" width="62" height="136" rx="12" fill="#0e0f12"/><rect x="94" y="24" width="52" height="120" rx="8" fill="#fff"/>
<rect x="100" y="34" width="40" height="22" rx="5" fill="#d9f0fc"/>${lines(100, 64, [40, 30, 36], 9, "#cfd8e2")}
<rect x="100" y="124" width="40" height="12" rx="6" fill="#0e0f12"/></g>`,
  ),
  "cover-default.svg": tile(
    "#183a5a",
    "#5dbbf0",
    win(`${mark(48, 50, 18)}${lines(74, 54, [80, 56], 9, "#183a5a")}${lines(48, 82, [110, 90, 124], 11, "#cfd8e2")}<rect x="48" y="120" width="50" height="12" rx="6" fill="#ffd54a"/>`),
  ),
};

for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
console.log(`Wrote ${Object.keys(files).length} nav thumbnails to`, out);
