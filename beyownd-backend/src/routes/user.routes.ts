// src/routes/user.routes.ts
// Saare routes logged-in user ke liye - protect router level pe ek baar.

import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { onboardingValidator, updateProfileValidator } from '../validators/user.validator';

const router = Router();

router.use(protect);

router.get('/me', userController.getMe);
router.put('/me/onboarding', onboardingValidator, validate, userController.completeOnboarding);
router.patch('/me/profile', updateProfileValidator, validate, userController.updateProfile);

export default router;
