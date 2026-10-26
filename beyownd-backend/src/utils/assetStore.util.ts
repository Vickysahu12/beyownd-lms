// src/utils/assetStore.util.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Lesson ke images + interactive widgets (HTML simulators) kahan rakhe
// jaate hai - EK jagah. Abhi (dev): local folder .tmp/assets (gitignored).
// Production (Phase 6): Cloudflare R2 + CDN - tab sirf yeh file badlegi.
//
// CONTENT-ADDRESSED: file ka naam = uske bytes ka hash (sha256, 16 hex).
//   - Same file dobara upload/import → same naam, kuch naya nahi banta
//     (re-import idempotent, do lessons ek hi image share karte hai)
//   - Naam kabhi nahi badalta → browser/CDN 1 saal cache kar sakte hai
//   - 64-bit random-jaisa naam → guess nahi ho sakta
//
// Lesson mein reference: "beyownd-asset:<hash>.<ext>". Serve karte waqt
// catalog service isse public URL mein badalta hai (resolveAssetRefs) -
// isliye storage (local → R2) badalne pe DB ka content nahi badalna padta.
//
// SAFETY (upload pe check, serve pe headers - dono):
// - Images: magic bytes extension se match hone chahiye (png jo asal mein
//   html hai = reject). SVG mein script / event handler / external link = reject.
// - Widgets (HTML): self-contained hone chahiye (external script/css = CSP
//   block kar dega, isliye upload pe hi saaf error).
// - Serve headers (asset.routes.ts): CSP `sandbox` → widget direct khola
//   jaaye tab bhi opaque origin, cookies/API tak pahunch nahi; connect-src
//   'none' → network call nahi.
// ────────────────────────────────────────────────────────────────────────

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { env } from '../config/env';

const ROOT = path.resolve(process.env.ASSET_LOCAL_DIR || path.join(__dirname, '..', '..', '.tmp', 'assets'));
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || `http://localhost:${env.port}`).replace(/\/$/, '');
// Phase 6: R2/CDN ka URL yahan (e.g. https://assets.beyownd.in)
export const ASSET_BASE_URL = (process.env.ASSET_PUBLIC_URL || `${API_PUBLIC_URL}/api/assets`).replace(/\/$/, '');

export const ASSET_LIMITS = {
  imageBytes: 2 * 1024 * 1024,
  widgetBytes: 300 * 1024,
  // Above this an image still uploads, but the importer warns (₹8k phones on 4G)
  imageWarnBytes: 400 * 1024,
};

export type AssetExt = 'png' | 'jpg' | 'jpeg' | 'webp' | 'gif' | 'svg' | 'html';
export const ASSET_NAME = /^[a-f0-9]{16}\.(png|jpg|jpeg|webp|gif|svg|html)$/;

export const CONTENT_TYPES: Record<AssetExt, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  html: 'text/html; charset=utf-8',
};

export const extOf = (filename: string): AssetExt | null => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ext in CONTENT_TYPES && filename.includes('.') ? (ext as AssetExt) : null;
};

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

const decodeUtf8 = (bytes: Buffer): string | null => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
};

// null = OK, string = why it was rejected (shown to the writer)
export const inspectAsset = (bytes: Buffer, ext: AssetExt): string | null => {
  if (bytes.length === 0) return 'file is empty';

  if (ext === 'html') {
    if (bytes.length > ASSET_LIMITS.widgetBytes) return `widget is ${Math.round(bytes.length / 1024)} KB - max ${ASSET_LIMITS.widgetBytes / 1024} KB (keep it one small self-contained file)`;
    const html = decodeUtf8(bytes);
    if (html === null) return 'widget is not a UTF-8 text file';
    if (!/<(html|body|script|div|svg|canvas|main|section)\b/i.test(html)) return "this doesn't look like an HTML file";
    const external = html.match(/<(script|link|iframe|img|audio|video|source)\b[^>]*\s(src|href)\s*=\s*["']?\s*(https?:)?\/\//i);
    if (external) return `widget loads <${external[1]}> from the internet - widgets must be self-contained (inline the CSS/JS, use data: images)`;
    if (/@import\s+(url\()?\s*["']?(https?:)?\/\//i.test(html)) return 'widget imports CSS from the internet - inline it instead';
    return null;
  }

  if (bytes.length > ASSET_LIMITS.imageBytes) return `image is ${(bytes.length / 1024 / 1024).toFixed(1)} MB - max 2 MB (compress it, e.g. squoosh.app)`;

  switch (ext) {
    case 'png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? null : 'file is not really a PNG';
    case 'jpg':
    case 'jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]) ? null : 'file is not really a JPEG';
    case 'gif':
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) ? null : 'file is not really a GIF';
    case 'webp':
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) ? null : 'file is not really a WebP';
    case 'svg': {
      const svg = decodeUtf8(bytes);
      if (svg === null) return 'SVG is not a UTF-8 text file';
      if (!/<svg[\s>]/i.test(svg)) return 'file is not really an SVG';
      if (/<!ENTITY/i.test(svg)) return 'SVG with <!ENTITY> declarations is not allowed';
      if (/<script[\s>]/i.test(svg)) return 'SVG contains <script> - remove it';
      if (/<foreignObject[\s>]/i.test(svg)) return 'SVG contains <foreignObject> - remove it';
      if (/\son[a-z]+\s*=/i.test(svg)) return 'SVG contains event handlers (onload=…) - remove them';
      if (/(href|src)\s*=\s*["']?\s*(javascript:|https?:|\/\/)/i.test(svg)) return 'SVG links to external files or javascript: - embed everything in the SVG';
      return null;
    }
    default:
      return 'unsupported file type';
  }
};

export const assetNameFor = (bytes: Buffer, ext: AssetExt) =>
  `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${ext === 'jpeg' ? 'jpg' : ext}`;

export const assetRef = (name: string) => `beyownd-asset:${name}`;
export const assetUrl = (name: string) => `${ASSET_BASE_URL}/${name}`;

const resolveName = (name: string) => {
  if (!ASSET_NAME.test(name)) throw new Error(`Invalid asset name: ${name}`);
  return path.join(ROOT, name);
};

// Idempotent: already there (same hash = same bytes) → nothing written
export const putAsset = async (name: string, bytes: Buffer): Promise<void> => {
  const file = resolveName(name);
  if (await assetExists(name)) return;
  await fs.mkdir(ROOT, { recursive: true });
  // write to temp + rename: a half-written file is never served
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, file);
};

export const assetExists = async (name: string): Promise<boolean> => {
  if (!ASSET_NAME.test(name)) return false;
  try {
    await fs.access(resolveName(name));
    return true;
  } catch {
    return false;
  }
};

export const readAsset = async (name: string): Promise<Buffer | null> => {
  if (!ASSET_NAME.test(name)) return null;
  try {
    return await fs.readFile(resolveName(name));
  } catch {
    return null;
  }
};

// Validate + store in one step (admin upload). Returns the lesson reference.
export const saveAsset = async (bytes: Buffer, filename: string) => {
  const ext = extOf(filename);
  if (!ext) return { error: `"${filename}" - allowed: ${Object.keys(CONTENT_TYPES).join(', ')}` } as const;
  const problem = inspectAsset(bytes, ext);
  if (problem) return { error: problem } as const;
  const name = assetNameFor(bytes, ext);
  await putAsset(name, bytes);
  return {
    asset: {
      name,
      ref: assetRef(name),
      url: assetUrl(name),
      kind: ext === 'html' ? ('interactive' as const) : ('image' as const),
      bytes: bytes.length,
    },
  } as const;
};
