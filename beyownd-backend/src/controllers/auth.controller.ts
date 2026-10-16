// src/controllers/auth.controller.ts
// Thin layer - request se data nikalna, service call karna, response
// bhejna. Koi business logic yahan nahi, sab auth.service.ts mein hai.
//
// try/catch nahi hai - Express 5 async handler ka rejected promise khud
// errorHandler middleware tak bhej deta hai.

import { Request, Response, CookieOptions } from 'express';
import * as authService from '../services/auth.service';
import { REFRESH_TTL_SECONDS } from '../services/session.service';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const REFRESH_COOKIE = 'refreshToken';

// path '/api/auth' - cookie sirf auth routes pe jaati hai, baaki har API
// call pe nahi (kam exposure, chhoti requests).
// sameSite 'strict' - classroom.beyownd.in aur api.beyownd.in same-site
// hai, to cookie kaam karegi, lekin kisi doosri site se aayi request ke
// saath kabhi nahi jaayegi (CSRF protection).
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  path: '/api/auth',
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, { ...cookieBase, maxAge: REFRESH_TTL_SECONDS * 1000 });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, cookieBase);
};

// Login jaise saare flows ka common response: refresh → cookie, baaki → body
const sendAuth = (res: Response, result: authService.AuthResult, status = 200) => {
  setRefreshCookie(res, result.refreshToken);
  res.status(status).json({ success: true, user: result.user, accessToken: result.accessToken });
};

export const signup = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const result = await authService.signup(name, email, password);
  res.status(201).json({ success: true, ...result });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  sendAuth(res, await authService.verifyEmail(email, otp));
};

export const resendOtp = async (req: Request, res: Response) => {
  const result = await authService.resendVerificationOtp(req.body.email);
  res.status(200).json({ success: true, ...result });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  sendAuth(res, await authService.login(email, password));
};

export const googleLogin = async (req: Request, res: Response) => {
  sendAuth(res, await authService.googleLogin(req.body.idToken));
};

export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw AppError.unauthorized('Session expired. Please log in again.', 'SESSION_INVALID');

  try {
    sendAuth(res, await authService.refresh(token));
  } catch (err) {
    // Invalid session - browser mein pada bekaar cookie bhi hata do
    clearRefreshCookie(res);
    throw err;
  }
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body.email);
  res.status(200).json({ success: true, ...result });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, password } = req.body;
  const result = await authService.resetPassword(email, otp, password);
  clearRefreshCookie(res);
  res.status(200).json({ success: true, ...result });
};
