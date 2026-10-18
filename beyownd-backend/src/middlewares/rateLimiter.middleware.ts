// src/middlewares/rateLimiter.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Brute-force aur spam se bachav. Counters Redis mein - isliye 2, 3, 4 API
// instances ke beech bhi limit ek hi rehti hai (in-memory counter har
// instance ka alag hota).
//
// CAMPUS PROBLEM: tier 3/4 colleges mein poori lab ek hi Wi-Fi / public IP
// se aati hai. Sirf IP pe limit lagaye to ek student ki galti se poori
// class block ho jaati. Isliye do layers:
//   1. Per IP + EMAIL (strict)  - ek account pe brute force rokta hai
//   2. Per IP (loose ceiling)   - ek IP se bahut saare accounts try karna rokta hai,
//                                 lekin 60 students ki lab ke liye kaafi room
//
// Har limiter ka apna Redis PREFIX hai. Pehle sab default 'rl:' share
// karte the - matlab OTP resend aur login ek hi counter kha rahe the.
// ────────────────────────────────────────────────────────────────────────

import { rateLimit, ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request } from 'express';
import { redisClient } from '../config/redis';

type KeyBy = 'ip' | 'ip+email';

interface LimiterOptions {
  name: string; // Redis prefix ke liye - har limiter unique
  windowMinutes: number;
  max: number;
  keyBy: KeyBy;
  message: string;
}

// IPv6 users ko /56 subnet se group karta hai - warna ek IPv6 user har
// request alag address se bhej ke limit bypass kar sakta hai
const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

const createLimiter = ({ name, windowMinutes, max, keyBy, message }: LimiterOptions): RateLimitRequestHandler =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      if (keyBy === 'ip') return clientIp(req);
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${clientIp(req)}:${email}`;
    },
    message: { success: false, message, code: 'RATE_LIMITED' },
    store: new RedisStore({
      prefix: `rl:${name}:`,
      sendCommand: (...args: string[]) =>
        redisClient.call(...(args as [string, ...string[]])) as any,
    }),
  });

// ---- Login ----
export const loginLimiter = [
  createLimiter({
    name: 'login-email', windowMinutes: 15, max: 10, keyBy: 'ip+email',
    message: 'Too many login attempts for this account. Try again in 15 minutes.',
  }),
  createLimiter({
    name: 'login-ip', windowMinutes: 15, max: 200, keyBy: 'ip',
    message: 'Too many login attempts from this network. Try again in 15 minutes.',
  }),
];

// ---- Signup ----
export const signupLimiter = [
  createLimiter({
    name: 'signup-email', windowMinutes: 60, max: 5, keyBy: 'ip+email',
    message: 'Too many signup attempts. Try again in an hour.',
  }),
  createLimiter({
    name: 'signup-ip', windowMinutes: 60, max: 100, keyBy: 'ip',
    message: 'Too many signups from this network. Try again later.',
  }),
];

// ---- OTP verify (per-OTP attempt limit bhi hai otp.util.ts mein) ----
export const otpVerifyLimiter = [
  createLimiter({
    name: 'otp-verify-email', windowMinutes: 15, max: 15, keyBy: 'ip+email',
    message: 'Too many attempts. Try again in 15 minutes.',
  }),
  createLimiter({
    name: 'otp-verify-ip', windowMinutes: 15, max: 300, keyBy: 'ip',
    message: 'Too many attempts from this network. Try again later.',
  }),
];

// ---- OTP send (resend + forgot password) - email quota bachata hai ----
export const otpSendLimiter = [
  createLimiter({
    name: 'otp-send-email', windowMinutes: 60, max: 5, keyBy: 'ip+email',
    message: 'Too many code requests. Try again in an hour.',
  }),
  createLimiter({
    name: 'otp-send-ip', windowMinutes: 60, max: 100, keyBy: 'ip',
    message: 'Too many code requests from this network. Try again later.',
  }),
];

// ---- Google + refresh - token-based hai, sirf abuse ceiling ----
export const tokenLimiter = createLimiter({
  name: 'token-ip', windowMinutes: 15, max: 300, keyBy: 'ip',
  message: 'Too many requests. Try again later.',
});

// ---- Public pages (catalog, verify) - sirf abuse/scraping ceiling ----
// Ek lab ke 60 students ek IP se browse karein to bhi kaafi room. Yeh pages
// Redis se serve hote hai, isliye limit DB bachane ke liye nahi, bots ke liye hai.
export const publicLimiter = createLimiter({
  name: 'public-ip', windowMinutes: 1, max: 1000, keyBy: 'ip',
  message: 'Too many requests. Please slow down.',
});
