// src/routes/review.routes.ts
// Sirf mentor + admin (decision D6). Student ko 403.

import { Router } from 'express';
import * as reviewController from '../controllers/review.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reviewQueueValidator, reviewDecisionValidator } from '../validators/review.validator';

const router = Router();

router.use(protect, restrictTo('mentor', 'admin'));

router.get('/submissions', reviewQueueValidator, validate, reviewController.queue);
router.get('/submissions/:id', reviewController.getOne);
router.post('/submissions/:id/decision', reviewDecisionValidator, validate, reviewController.decide);

export default router;
