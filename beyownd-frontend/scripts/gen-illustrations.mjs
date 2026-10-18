// Generates Beyownd's original hero illustrations into public/illustrations/.
// Run: node scripts/gen-illustrations.mjs
//
// These are stand-ins in the brief's painterly spirit (soft puffs, noise-displaced
// edges, warm light from the sun side). Swap them for commissioned / owner-made
// AVIF/WebP art when it exists; file names and sizes are the contract.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "illustrations");
mkdirSync(out, { recursive: true });

// Small deterministic PRNG so the art is stable between runs.
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

/**
 * A cloud = one merged silhouette of overlapping puffs (so it reads as a single
 * soft mass, not popcorn), lit from above: white crown, blue-grey belly,
 * plus faint per-puff highlights for painterly lumpiness.
 * warm: 0..1, how much sun-coloured light catches the right side.
 */
function cloud({ seed, w, h, puffs, warm = 0, humps = 2 }) {
  const rand = rng(seed);
  const base = h * 0.8;
  const centres = Array.from({ length: humps }, (_, k) => (k + 0.5) / humps + (rand() - 0.5) * 0.12);
  const heights = centres.map(() => 0.55 + rand() * 0.45);
  const profile = (x) => {
    const t = x / w;
    let y = 0;
    centres.forEach((c, k) => (y = Math.max(y, heights[k] * Math.exp(-((t - c) ** 2) / (0.5 / humps) ** 2))));
    return y * Math.sin(Math.PI * t) ** 0.5;
  };

  const puffsOut = [];
  const highlights = [];
  // bottom row: wide, low, forms the flat belly
  for (let i = 0; i < puffs; i++) {
    const x = w * (0.1 + 0.8 * (i / (puffs - 1))) + (rand() - 0.5) * w * 0.03;
    const r = h * (0.12 + rand() * 0.05);
    puffsOut.push([x, base - r * 0.55, r]);
  }
  // body and crown rows follow the hump profile
  for (const [lift, rMin, rMax, n] of [
    [0.38, 0.13, 0.2, puffs],
    [0.62, 0.1, 0.17, Math.round(puffs * 0.75)],
  ]) {
    for (let i = 0; i < n; i++) {
      const x = w * (0.14 + 0.72 * (i / (n - 1))) + (rand() - 0.5) * w * 0.05;
      const p = profile(x);
      if (p < 0.12) continue;
      const r = h * (rMin + rand() * (rMax - rMin)) * (0.75 + p * 0.6);
      const y = Math.max(base - p * h * lift - r * 0.2, r + h * 0.06);
      puffsOut.push([x, y, r]);
      highlights.push([x - r * 0.2, y - r * 0.25, r * 0.7]);
    }
  }
  const top = Math.min(...puffsOut.map(([, y, r]) => y - r));
  const circles = puffsOut.map(([x, y, r]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`).join("");
  const hl = highlights
    .map(([x, y, r]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="url(#hl)"/>`)
    .join("");
  const blur = r1(h * 0.012);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
  <linearGradient id="vol" x1="0" y1="${r1(top)}" x2="0" y2="${r1(base + h * 0.04)}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#f7fbfe"/>
    <stop offset="0.8" stop-color="#d6eaf7"/><stop offset="1" stop-color="#b6d6ee"/>
  </linearGradient>
  <linearGradient id="warm" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0.35" stop-color="#ffd9a0" stop-opacity="0"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="${warm}"/>
  </linearGradient>
  <radialGradient id="hl"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="paint" x="-8%" y="-15%" width="116%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="${r1((3.2 / h) * 1000) / 1000}" numOctaves="3" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${Math.round(h * 0.05)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${blur}"/>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${seed + 3}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.76  0 0 0 0 0.9  0 0 0 0.12 0"/>
  </filter>
  <mask id="shape" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><g fill="#fff" filter="url(#paint)">${circles}</g></mask>
</defs>
<g mask="url(#shape)">
  <rect width="${w}" height="${h}" fill="url(#vol)"/>
  <g filter="url(#paint)" opacity="0.9">${hl}</g>
  ${warm ? `<rect width="${w}" height="${h}" fill="url(#warm)"/>` : ""}
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
</g>
</svg>`;
}

const clouds = {
  "cloud-bank-left.svg": { seed: 11, w: 900, h: 420, puffs: 13, humps: 3 },
  "cloud-sun.svg": { seed: 27, w: 760, h: 360, puffs: 11, humps: 2, warm: 0.75 },
  "cloud-wisp.svg": { seed: 42, w: 420, h: 160, puffs: 8, humps: 2 },
  "cloud-small.svg": { seed: 58, w: 300, h: 150, puffs: 6, humps: 1 },
};
for (const [name, opts] of Object.entries(clouds)) {
  writeFileSync(join(out, name), cloud(opts));
}

// Hot-air balloon carrying a rolled certificate with a ribbon.
const envelope =
  "M120 14C178 14 222 58 222 116C222 160 193 192 160 222C152 229 148 236 146 244H94C92 236 88 229 80 222C47 192 18 160 18 116C18 58 62 14 120 14Z";
const balloon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 380" width="240" height="380">
<defs>
  <clipPath id="env"><path d="${envelope}"/></clipPath>
  <radialGradient id="light" cx="0.34" cy="0.26" r="0.78">
    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
    <stop offset="0.45" stop-color="#fff" stop-opacity="0.08"/>
    <stop offset="1" stop-color="#183a5a" stop-opacity="0.32"/>
  </radialGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0.6" stop-color="#ffb547" stop-opacity="0"/>
    <stop offset="1" stop-color="#ffb547" stop-opacity="0.45"/>
  </linearGradient>
  <linearGradient id="basket" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c98f55"/><stop offset="1" stop-color="#8d5a2e"/>
  </linearGradient>
  <linearGradient id="scroll" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#e9dfc9"/><stop offset="0.45" stop-color="#fffaf0"/><stop offset="1" stop-color="#ddd0b4"/>
  </linearGradient>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.2  0 0 0 0 0.3  0 0 0 0.08 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>
<g filter="url(#soft)">
  <!-- ropes -->
  <g stroke="#5b4a3a" stroke-width="1.6" stroke-linecap="round" opacity="0.85">
    <path d="M96 246L90 300"/><path d="M144 246L150 300"/><path d="M110 248L106 300"/><path d="M130 248L134 300"/>
  </g>
  <!-- envelope with curved gores -->
  <g clip-path="url(#env)">
    <rect width="240" height="260" fill="#ffd54a"/>
    <ellipse cx="120" cy="120" rx="78" ry="150" fill="#fff4dc"/>
    <ellipse cx="120" cy="120" rx="46" ry="150" fill="#ffd54a"/>
    <ellipse cx="120" cy="120" rx="16" ry="150" fill="#fff4dc"/>
    <path d="M0 212H240V260H0Z" fill="#183a5a" opacity="0.92"/>
    <path d="M0 208H240" stroke="#fff4dc" stroke-width="3" opacity="0.9"/>
    <rect width="240" height="260" fill="url(#light)"/>
    <rect width="240" height="260" fill="url(#rim)"/>
    <rect width="240" height="260" filter="url(#grain)"/>
  </g>
  <!-- mouth -->
  <path d="M94 244H146L142 252H98Z" fill="#0e2a44"/>
  <!-- rolled certificate standing in the basket, ribbon tied round the middle -->
  <g transform="rotate(-18 136 300)">
    <rect x="96" y="276" width="96" height="26" rx="13" fill="url(#scroll)" stroke="#d2c4a4" stroke-width="1"/>
    <ellipse cx="192" cy="289" rx="6.5" ry="13" fill="#f6eedb" stroke="#c9b892" stroke-width="1.2"/>
    <path d="M190 282c-4 3-4 11 0 14" stroke="#c9b892" stroke-width="1.2" fill="none"/>
    <rect x="138" y="275" width="10" height="28" fill="#7b61ff"/>
    <path d="M139 300l-9 24 8-4 3 8 5-27z" fill="#6a50f0"/>
    <path d="M147 300l6 25 3-7 7 3-9-23z" fill="#5a42d6"/>
    <circle cx="143" cy="289" r="8" fill="#ffd54a" stroke="#e3b42c" stroke-width="1.4"/>
    <circle cx="143" cy="289" r="4" fill="none" stroke="#e3b42c" stroke-width="1"/>
  </g>
  <!-- basket -->
  <path d="M86 300H154L148 340C147 345 143 348 138 348H102C97 348 93 345 92 340Z" fill="url(#basket)"/>
  <path d="M84 296H156V306H84Z" rx="3" fill="#7a4c26"/>
  <g stroke="#6b411f" stroke-width="1.2" opacity="0.55">
    <path d="M92 318H148"/><path d="M93 330H147"/><path d="M106 306V346"/><path d="M120 306V348"/><path d="M134 306V346"/>
  </g>
</g>
</svg>`;
writeFileSync(join(out, "balloon.svg"), balloon);

console.log("Wrote illustrations to", out);
