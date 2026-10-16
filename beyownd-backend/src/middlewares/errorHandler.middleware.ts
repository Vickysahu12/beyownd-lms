// src/middlewares/errorHandler.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Poore app ka EK central error handler. Express 5 async controllers ke
// rejected promises bhi automatically yahan bhej deta hai - isliye
// controllers mein try/catch ki zaroorat nahi.
//
// Har error ko sahi status code + consistent shape mein convert karta hai:
//   { success: false, message, code }
// Unknown errors (bugs) ka asli message client ko production mein NAHI
// dikhate - woh internal details leak kar sakta hai. Woh sirf log hota hai.
// ────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface NormalizedError {
  statusCode: number;
  message: string;
  code: string;
}

// Library-specific errors ko humare standard shape mein badalta hai.
const normalize = (err: any): NormalizedError | null => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, code: err.code };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return { statusCode: 400, message, code: 'VALIDATION_ERROR' };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: `Invalid ${err.path}`, code: 'INVALID_ID' };
  }
  // Unique index violation - e.g. do requests ek saath same email se signup
  if (err?.code === 11000) {
    return { statusCode: 409, message: 'Resource already exists', code: 'DUPLICATE' };
  }
  if (err instanceof jwt.TokenExpiredError) {
    return { statusCode: 401, message: 'Token expired', code: 'TOKEN_EXPIRED' };
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return { statusCode: 401, message: 'Invalid token', code: 'INVALID_TOKEN' };
  }
  // express.json() ke errors - body bahut badi ya JSON toota hua
  if (err?.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' };
  }
  if (err?.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Malformed JSON body', code: 'MALFORMED_JSON' };
  }
  return null;
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const known = normalize(err);
  const log = req.log ?? logger;

  if (known) {
    // Expected error - warn level, stack trace ki zaroorat nahi
    log.warn({ code: known.code, statusCode: known.statusCode }, known.message);
    return res.status(known.statusCode).json({
      success: false,
      message: known.message,
      code: known.code,
    });
  }

  // Unknown = bug ya infra failure. Poora error stack ke saath log karo.
  log.error({ err }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    message: env.isProduction ? 'Something went wrong' : err?.message || 'Something went wrong',
    code: 'INTERNAL_ERROR',
  });
};

// 404 - koi route match nahi hua. Error handler se pehle register hota hai.
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'ROUTE_NOT_FOUND' });
};
