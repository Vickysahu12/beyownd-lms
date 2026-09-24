// src/controllers/auth.controller.ts
// Thin layer - request se data nikalna, service call karna, response
// bhejna. Koi business logic yahan nahi, sab auth.service.ts mein hai.

import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { env } from '../config/env';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.signup(name, email, password);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    const { user, accessToken, refreshToken } = await authService.verifyOtpAndActivate(email, otp);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ success: true, user, accessToken });
  } catch (err) { next(err); }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.resendOtp(req.body.email);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(email, password);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ success: true, user, accessToken });
  } catch (err) { next(err); }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, accessToken, refreshToken } = await authService.googleLogin(req.body.idToken);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ success: true, user, accessToken });
  } catch (err) { next(err); }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) throw new Error('No refresh token provided');
    const result = await authService.refreshAccessToken(token);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};