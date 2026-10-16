// src/config/env.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Saare environment variables EK jagah load + validate hote hai. Koi bhi
// file directly process.env nahi padhegi - sab `env` object se lenge.
// Required variable missing ho to server start hi nahi hoga (fail fast),
// taaki production mein "undefined secret" jaisa silent bug na aaye.
// ────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function getNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`Environment variable ${key} must be a number`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: getNumber('PORT', 5000),

  // Comma-separated list - e.g. "https://classroom.beyownd.in". Sirf yahi
  // origins browser se cookies ke saath API call kar sakte hai.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Nginx ke peeche 1 hop. Dev mein 0 (koi proxy nahi). Galat value se
  // rate limiter ya to har user ko ek hi IP samjhega, ya IP spoof ho sakega.
  trustProxy: getNumber('TRUST_PROXY', nodeEnv === 'production' ? 1 : 0),

  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),

  mongoUri: getEnvVar('MONGO_URI'),
  // Per API instance. 2 instances x 20 = 40 connections - Atlas tier ki
  // connection limit se kaafi neeche, scale karne ki jagah bachti hai.
  mongoMaxPoolSize: getNumber('MONGO_MAX_POOL_SIZE', 20),

  redisUrl: getEnvVar('REDIS_URL'),

  jwtAccessSecret: getEnvVar('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: getEnvVar('JWT_REFRESH_SECRET'),
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

  resendApiKey: getEnvVar('RESEND_API_KEY'),
  emailFrom: getEnvVar('EMAIL_FROM'),
  googleClientId: getEnvVar('GOOGLE_CLIENT_ID'),
};
