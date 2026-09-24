// src/middlewares/rateLimiter.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Login/signup jaise sensitive routes ko brute-force attacks se bachata
// hai - ek hi IP se bahut zyada attempts aaye to block kar deta hai.
// Redis use karta hai count store karne ke liye (already set up hai) -
// isse yeh multiple server instances ke beech bhi consistently kaam
// karega jab kabhi tu horizontally scale karega (system design doc mein
// jo discuss kiya tha).
// ────────────────────────────────────────────────────────────────────────

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';

// Login/signup ke liye strict limiter - 5 attempts per 15 minutes per IP.
// Genuine user galti se 2-3 baar galat password daal sakta hai - 5
// reasonable buffer hai. Isse zyada = likely brute-force attempt.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.call(...(args as [string, ...string[]])) as any,
  }),
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 10 minutes.',
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.call(...(args as [string, ...string[]])) as any,
  }),
});