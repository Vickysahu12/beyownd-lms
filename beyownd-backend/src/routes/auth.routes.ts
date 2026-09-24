// src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  signupValidator, loginValidator, verifyOtpValidator, resendOtpValidator,
} from '../validators/auth.validator';
import { authLimiter, otpLimiter } from '../middlewares/rateLimiter.middleware';


const router = Router();

router.post('/signup',authLimiter, signupValidator, validate, authController.signup);
router.post('/verify-otp', verifyOtpValidator, validate, authController.verifyOtp);
router.post('/resend-otp',otpLimiter, resendOtpValidator, validate, authController.resendOtp);
router.post('/login',authLimiter, loginValidator, validate, authController.login);
router.post('/google', authController.googleLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;