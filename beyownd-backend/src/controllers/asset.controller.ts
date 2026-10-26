// src/controllers/asset.controller.ts
//
// Lesson images + interactive widgets serve karta hai (public, cacheable).
// Security headers yahan set hote hai - widgets KISI aur ki site ka code
// hai jaisa treat karo:
//   - HTML widget: CSP `sandbox allow-scripts` → opaque origin. Direct
//     URL khola jaaye tab bhi hamari cookies / API tak pahunch nahi.
//     connect-src 'none' → fetch/WebSocket nahi. frame-ancestors → sirf
//     hamara frontend ise iframe mein daal sakta hai.
//   - SVG: CSP `sandbox` bina scripts → direct khola jaaye to bhi JS nahi.
//   - Helmet ke defaults override: X-Frame-Options hataya (warna frontend
//     iframe nahi kar paata), CORP cross-origin (frontend alag domain hai).

import { Request, Response } from 'express';
import { env } from '../config/env';
import { ASSET_NAME, CONTENT_TYPES, AssetExt, readAsset, saveAsset } from '../utils/assetStore.util';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const frameAncestors = env.corsOrigins.length ? env.corsOrigins.join(' ') : "'none'";

const policyFor = (ext: AssetExt) => {
  if (ext === 'html') {
    return [
      'sandbox allow-scripts',
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      'img-src data: blob:',
      'font-src data:',
      "connect-src 'none'",
      "form-action 'none'",
      `frame-ancestors ${frameAncestors}`,
    ].join('; ');
  }
  if (ext === 'svg') return "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
  return "default-src 'none'; sandbox";
};

export const serve = async (req: Request<{ name: string }>, res: Response) => {
  const { name } = req.params;
  if (!ASSET_NAME.test(name)) throw AppError.notFound('Asset not found');

  const etag = `"${name}"`;
  const ext = name.split('.').pop() as AssetExt;
  const setHeaders = () => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Security-Policy', policyFor(ext));
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.removeHeader('X-Frame-Options');
  };

  // Name = hash of the bytes → if the browser has this name, it has these bytes
  if (req.headers['if-none-match'] === etag) {
    setHeaders();
    res.status(304).end();
    return;
  }
  const bytes = await readAsset(name);
  if (!bytes) throw AppError.notFound('Asset not found');
  setHeaders();
  res.setHeader('Content-Type', CONTENT_TYPES[ext]);
  res.setHeader('Content-Disposition', 'inline');
  res.send(bytes);
};

// Admin upload: raw bytes in the body, original file name in ?filename=
export const upload = async (req: Request, res: Response) => {
  const filename = typeof req.query.filename === 'string' ? req.query.filename.trim() : '';
  if (!filename || filename.length > 120) throw AppError.badRequest('Send ?filename=<name.ext> with the upload', 'ASSET_INVALID');
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw AppError.badRequest('Send the file bytes as the request body (not JSON or a form)', 'ASSET_INVALID');
  }
  const result = await saveAsset(req.body, filename);
  if ('error' in result) throw AppError.badRequest(`${filename}: ${result.error}`, 'ASSET_INVALID');
  logger.info({ asset: result.asset.name, bytes: result.asset.bytes, by: req.user?.id }, 'asset uploaded');
  res.status(201).json({ success: true, asset: result.asset });
};
