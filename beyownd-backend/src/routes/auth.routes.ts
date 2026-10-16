// src/routes/auth.routes.ts
// Order har route mein: rate limiter → validator → validate → controller.
// Limiter SABSE PEHLE - spam request validation ka CPU bhi na khaaye.

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  signupValidator,
  loginValidator,
  verifyOtpValidator,
  emailOnlyValidator,
  resetPasswordValidator,
  googleLoginValidator,
} from '../validators/auth.validator';
import {
  loginLimiter,
  signupLimiter,
  otpVerifyLimiter,
  otpSendLimiter,
  tokenLimiter,
} from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/signup', signupLimiter, signupValidator, validate, authController.signup);
router.post('/verify-otp', otpVerifyLimiter, verifyOtpValidator, validate, authController.verifyOtp);
router.post('/resend-otp', otpSendLimiter, emailOnlyValidator, validate, authController.resendOtp);
router.post('/login', loginLimiter, loginValidator, validate, authController.login);
router.post('/google', tokenLimiter, googleLoginValidator, validate, authController.googleLogin);
router.post('/refresh', tokenLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', otpSendLimiter, emailOnlyValidator, validate, authController.forgotPassword);
router.post('/reset-password', otpVerifyLimiter, resetPasswordValidator, validate, authController.resetPassword);

export default router;
