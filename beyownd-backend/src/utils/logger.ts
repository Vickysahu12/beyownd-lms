// src/utils/logger.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// console.log ki jagah structured (JSON) logging. Production mein har log
// line ek JSON object hogi - { level, time, reqId, msg, ... } - jise search
// aur filter kar sakte hai ("is reqId ki saari lines dikhao"). Dev mein
// pino-pretty se readable colored output milta hai.
//
// pino isliye: Node ke sabse fast loggers mein se ek hai - logging khud
// request latency nahi badhani chahiye.
// ────────────────────────────────────────────────────────────────────────

import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.logLevel,
  // Sensitive data kabhi log mein nahi jaana chahiye - passwords, tokens,
  // cookies. Agar galti se poora req.body log ho jaye, tab bhi yeh fields
  // "[Redacted]" ban jayenge.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.otp',
      '*.refreshToken',
      '*.accessToken',
      '*.idToken',
    ],
    censor: '[Redacted]',
  },
  // Pretty output sirf local dev mein. Production = raw JSON (log tools ke
  // liye), tests = koi extra worker thread nahi (Jest open handles).
  transport:
    env.isProduction || env.nodeEnv === 'test'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
