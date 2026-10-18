// src/routes/payment.routes.ts
import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { tokenLimiter } from '../middlewares/rateLimiter.middleware';
import { verifyPaymentValidator } from '../validators/payment.validator';

const router = Router();

router.use(protect);

router.post('/verify', tokenLimiter, verifyPaymentValidator, validate, paymentController.verify);
router.get('/', paymentController.listMine);

export default router;
