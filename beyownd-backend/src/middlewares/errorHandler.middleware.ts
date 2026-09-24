// src/middlewares/errorHandler.middleware.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Express mein agar kahin bhi (kisi bhi controller/service mein) error
// throw ho jaye ya next(error) call ho, to yeh CENTRAL handler use catch
// karta hai. Isse fayda yeh hai: tujhe har controller mein alag-alag
// try/catch likh ke error response format karne ki zaroorat nahi - ek
// hi jagah se, poore app ke liye, consistent error response nikalta hai.
// ────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

// Express ismein khud pehchaan leta hai ki yeh ek ERROR-handling middleware
// hai, kyunki iske 4 parameters hai (err, req, res, next) - normal
// middleware sirf 3 leta hai (req, res, next). Yeh Express ka apna rule hai.
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err.message);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
};