// src/utils/generateTokens.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Saare JWT sign/verify yahin hote hai - koi aur file directly jwt.sign()
// nahi likhti.
//
// ACCESS token  - 15 min, har API request ke saath (Authorization header).
//                 Payload: userId + role. Stateless - verify karne ke liye
//                 DB/Redis nahi chahiye, isliye har request fast.
// REFRESH token - 7 din, httpOnly cookie mein. Payload: userId + sid
//                 (session ID) + jti (is token ka unique ID). sid/jti Redis
//                 se match hote hai (services/session.service.ts) - isse
//                 rotation aur logout/revocation possible hota hai.
// Dono alag secrets se sign hote hai - refresh token ko access token ki
// jagah use nahi kiya ja sakta, aur ulta bhi nahi.
// ────────────────────────────────────────────────────────────────────────

import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sid: string;
  jti: string;
}

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiry as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId: payload.userId, role: payload.role }, env.jwtAccessSecret, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiry as SignOptions['expiresIn'],
  };
  return jwt.sign(
    { userId: payload.userId, sid: payload.sid, jti: payload.jti },
    env.jwtRefreshSecret,
    options
  );
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
};

// "7d" / "15m" jaisi string ko seconds mein - Redis TTL aur cookie maxAge
// dono isi se nikalte hai, taaki teeno (JWT, Redis, cookie) ek saath expire hon.
export const durationToSeconds = (value: string): number => {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Unsupported duration format: ${value}`);
  const amount = Number(match[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return amount * unit;
};
