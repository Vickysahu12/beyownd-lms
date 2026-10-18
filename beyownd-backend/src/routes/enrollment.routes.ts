// src/routes/enrollment.routes.ts
// Logged-in students. "Yeh enrollment tumhari hai?" check service karta hai
// (har request pe { _id, userId } se load) - URL mein doosre ka ID daalne se 404.
// POST /enrollments (naya enrollment + payment order) Phase 3 mein aayega.

import { Router } from 'express';
import * as enrollmentController from '../controllers/enrollment.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', enrollmentController.listMine);
router.get('/:id', enrollmentController.getDashboard);
router.get('/:id/lessons/:lessonId', enrollmentController.getLesson);
router.post('/:id/lessons/:lessonId/complete', enrollmentController.completeLesson);

export default router;
