// src/middlewares/validate.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// signupValidator/loginValidator jaise arrays sirf RULES define karte hai -
// yeh middleware unhe actually CHECK karta hai aur agar koi rule fail
// hua, response bhej deta hai. Route mein dono saath use honge:
// router.post('/signup', signupValidator, validate, authController.signup)
// ────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.type === 'field' ? err.path : undefined,
        message: err.msg,
      })),
    });
  }

  next();
};