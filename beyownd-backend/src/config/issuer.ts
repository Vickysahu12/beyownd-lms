// src/config/issuer.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Documents (offer letter, certificate, completion letter) KAUN issue karta
// hai - legal company (GrewDo) ki details. Beyownd brand hai, legal entity
// nahi (docs/business-model.md §7), isliye letterhead GrewDo ka.
//
// Sab .env se configurable - real details aate hi sirf .env badlo, code nahi.
// Jab tak nahi aate, PLACEHOLDER text chhapta hai jo saaf dikhta hai ki
// pending hai (production mein yeh kabhi nahi jaana chahiye - Phase 6 check).
//
// Har credential issue hote waqt is config ki SNAPSHOT apne andar save
// karta hai. Baad mein issuer badle (e.g. Beyownd alag company bane) to
// purane documents pe GrewDo hi rahega - jo sach hai.
// ────────────────────────────────────────────────────────────────────────

import path from 'path';

const PLACEHOLDER = (what: string) => `[${what} pending]`;

export const issuer = {
  legalName: process.env.ISSUER_LEGAL_NAME || 'GrewDo',
  registrationNo: process.env.ISSUER_REGISTRATION_NO || PLACEHOLDER('Registration no.'),
  address: process.env.ISSUER_ADDRESS || PLACEHOLDER('Registered address'),
  email: process.env.ISSUER_EMAIL || 'hello@beyownd.in',
  signatoryName: process.env.ISSUER_SIGNATORY_NAME || PLACEHOLDER('Signatory name'),
  signatoryTitle: process.env.ISSUER_SIGNATORY_TITLE || 'Founder',
  brand: 'Beyownd',
  programName: 'Beyownd Virtual Internship Program',
};

// Public verify page ka base URL - PDF + QR code mein chhapta hai
export const verifyBaseUrl = (process.env.VERIFY_BASE_URL || 'https://beyownd.in/verify').replace(/\/$/, '');

// Optional PNGs (logo, signature) - file maujood ho to PDF mein lagte hai,
// warna text-only letterhead. Owner se aane ke baad yahan rakhna hai.
export const brandingAssets = {
  logoPng: path.join(__dirname, '..', '..', 'assets', 'branding', 'logo.png'),
  signaturePng: path.join(__dirname, '..', '..', 'assets', 'branding', 'signature.png'),
};

// Phase 6 launch check: production mein koi placeholder nahi rehna chahiye
export const pendingIssuerFields = (): string[] =>
  Object.entries(issuer)
    .filter(([, v]) => typeof v === 'string' && v.endsWith('pending]'))
    .map(([k]) => k);
