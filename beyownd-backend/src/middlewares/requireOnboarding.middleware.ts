// src/middlewares/requireOnboarding.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Enroll aur payment jaise routes onboarding ke bina nahi chalne chahiye
// (certificate ke liye naam, college, phone chahiye). Frontend redirect
// karta hai, lekin koi seedha API call karke redirect skip kar sakta hai -
// isliye backend pe bhi check.
//
// Usage: router.post('/enroll', protect, requireOnboarding, ...)
//
// Har request pe ek chhota DB read (sirf ek boolean field) - theek hai
// kyunki yeh sirf enroll/payment jaise kam-frequency routes pe lagega,
// har API call pe nahi. Token mein flag daalte to onboarding ke baad
// naya token lena padta - extra complexity, koi fayda nahi.
// ────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { isOnboarded } from '../services/user.service';

export const requireOnboarding = async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) throw AppError.unauthorized();
  if (!(await isOnboarded(req.user.id))) {
    throw AppError.forbidden('Please complete your profile first', 'ONBOARDING_REQUIRED');
  }
  next();
};
