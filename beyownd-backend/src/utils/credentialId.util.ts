// src/utils/credentialId.util.ts
//
// Public credential ID: BYD-26-7KQ4-M9XA
//   BYD  = Beyownd (verification beyownd.in pe hoti hai)
//   26   = issue year
//   8 random chars from 31 letters/digits → 31^8 ≈ 850 billion combinations
//          - guess karke kisi ka certificate dhoondhna practical nahi
// Alphabet mein 0/O, 1/I/L nahi - TPO ID haath se type kare to galti na ho.

import { randomInt } from 'crypto';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const randomBlock = (length: number) =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const generateCredentialId = (date = new Date()): string =>
  `BYD-${String(date.getUTCFullYear()).slice(-2)}-${randomBlock(4)}-${randomBlock(4)}`;

// User jo bhi type kare (lowercase, spaces) → canonical form
export const normalizeCredentialId = (raw: string): string | null => {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^BYD-\d{2}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(cleaned) ? cleaned : null;
};
