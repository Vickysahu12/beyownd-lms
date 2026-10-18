// src/utils/storage.util.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// PDF files kahan rakhe jaate hai - EK jagah. Abhi (dev): local folder
// (.tmp/documents, gitignored). Production (Phase 6): Cloudflare R2 - tab
// sirf yeh file badlegi, baaki app ko farak nahi padega.
//
// Download: kabhi permanent public link nahi. Har download ke liye ek
// SIGNED URL banta hai jo 5 min mein expire hota hai:
//   /api/files/<key>?expires=<unix>&sig=<HMAC(key + expires)>
// Link share kiya to 5 min baad bekaar. R2 pe yahi kaam presigned URL karega.
// ────────────────────────────────────────────────────────────────────────

import fs from 'fs/promises';
import path from 'path';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

const ROOT = path.resolve(process.env.STORAGE_LOCAL_DIR || path.join(__dirname, '..', '..', '.tmp', 'documents'));
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || `http://localhost:${env.port}`).replace(/\/$/, '');
export const DOWNLOAD_TTL_SECONDS = 300;

// Alag secret derive - access-token secret seedha reuse nahi hota
const signingKey = createHash('sha256').update(`files:${env.jwtAccessSecret}`).digest();

// Key sirf safe characters - path traversal (../../etc) impossible
const KEY_PATTERN = /^[a-z0-9-]+\/[A-Z0-9-]+\.pdf$/;

const resolveKey = (key: string): string => {
  if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
  return path.join(ROOT, key);
};

export const putObject = async (key: string, bytes: Uint8Array): Promise<void> => {
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
};

export const readObject = async (key: string): Promise<Buffer> => fs.readFile(resolveKey(key));

const sign = (key: string, expires: number) => createHmac('sha256', signingKey).update(`${key}:${expires}`).digest('hex');

export const createDownloadUrl = (key: string, now = Date.now()) => {
  resolveKey(key);
  const expires = Math.floor(now / 1000) + DOWNLOAD_TTL_SECONDS;
  return {
    url: `${API_PUBLIC_URL}/api/files/${key}?expires=${expires}&sig=${sign(key, expires)}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
};

export const isValidDownloadSignature = (key: string, expires: number, sig: string): boolean => {
  if (!KEY_PATTERN.test(key) || !Number.isInteger(expires) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(sign(key, expires), 'hex'), Buffer.from(sig, 'hex'));
};
