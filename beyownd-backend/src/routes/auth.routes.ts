// src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  signupValidator, loginValidator, verifyOtpValidator, resendOtpValidator,
} from '../validators/auth.validator';

const router = Router();

router.post('/signup', signupValidator, validate, authController.signup);
router.post('/verify-otp', verifyOtpValidator, validate, authController.verifyOtp);
router.post('/resend-otp', resendOtpValidator, validate, authController.resendOtp);
router.post('/login', loginValidator, validate, authController.login);
router.post('/google', authController.googleLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;