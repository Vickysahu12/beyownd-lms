// src/utils/generateTokens.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Yeh do chhote functions rakhta hai jo access aur refresh token banate
// hai. auth.service.ts (agla step) yeh functions call karega login aur
// signup ke time, aur ek /refresh route bhi inhe call karega jab naya
// access token chahiye ho. Koi bhi file directly jwt.sign() nahi likhegi -
// sab yahi se guzrega, taaki agar kabhi token banane ka logic change
// karna pade (jaise extra data add karna), ek hi jagah badalna padega.
// ────────────────────────────────────────────────────────────────────────

import jwt, {SignOptions} from 'jsonwebtoken';
import { env } from '../config/env';

// Access token payload mein sirf userId aur role rakhte hai - itna hi
// kaafi hai har request pe "kaun hai yeh" aur "kya allowed hai" check
// karne ke liye. Zyada data token mein daalna avoid karte hai, kyunki
// token har request ke saath jaata hai - jitna chhota, utna fast.
interface TokenPayload {
  userId: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiry as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtAccessSecret, options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiry as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtRefreshSecret, options);
};

// Refresh token verify karne ka function - /refresh route isko call
// karega jab cookie se refresh token milega, yeh check karega ki woh
// genuine hai aur expire nahi hua.
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
};