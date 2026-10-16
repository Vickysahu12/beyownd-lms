// src/middlewares/auth.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// `protect` - access token verify karke req.user attach karta hai.
// `restrictTo` - role check (e.g. admin-only routes).
//
// SCALABILITY DECISION: protect DB ya Redis ko touch NAHI karta. Access
// token sirf verified users ko hi milta hai (verify-otp, login, Google -
// teeno verified user pe hi token dete hai), aur role token ke andar hai.
// Matlab har request pe sirf ek JWT signature check (~microseconds), koi
// network call nahi - 1000 users ki har API call pe ek DB read bachta hai.
//
// Trade-off: agar admin kisi ka role badle ya account delete kare, purana
// access token max 15 min tak chalega. Refresh pe user DB se dobara load
// hota hai, to agla token sahi hoga. Is platform ke liye yeh acceptable hai.
// ────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/generateTokens';
import { AppError } from '../utils/AppError';

export const protect = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Not authenticated', 'UNAUTHORIZED');
  }

  // Expired/invalid token → jwt error → errorHandler 401 TOKEN_EXPIRED /
  // INVALID_TOKEN deta hai. Frontend TOKEN_EXPIRED dekh ke /refresh call karega.
  const decoded = verifyAccessToken(authHeader.slice(7));
  req.user = { id: decoded.userId, role: decoded.role };
  next();
};

// Usage: router.get('/admin/stats', protect, restrictTo('admin'), ...)
export const restrictTo = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw AppError.forbidden('Access denied', 'FORBIDDEN');
    }
    next();
  };
};
