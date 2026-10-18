// src/routes/enrollment.routes.ts
// Logged-in students. "Yeh enrollment tumhari hai?" check service karta hai
// (har request pe { _id, userId } se load) - URL mein doosre ka ID daalne se 404.

import { Router } from 'express';
import * as enrollmentController from '../controllers/enrollment.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { quizAttemptValidator, projectSubmissionValidator } from '../validators/learning.validator';
import { startEnrollmentValidator } from '../validators/payment.validator';
import { requireOnboarding } from '../middlewares/requireOnboarding.middleware';
import { tokenLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.use(protect);

router.get('/', enrollmentController.listMine);
// Naya enrollment + Razorpay order. Onboarding zaroori (certificate ke liye naam/college)
router.post('/', tokenLimiter, requireOnboarding, startEnrollmentValidator, validate, enrollmentController.startEnrollment);
router.get('/:id', enrollmentController.getDashboard);
router.get('/:id/lessons/:lessonId', enrollmentController.getLesson);
router.post('/:id/lessons/:lessonId/complete', enrollmentController.completeLesson);

// Quiz - module ke end mein (cooldown + grading service mein)
router.get('/:id/modules/:moduleId/quiz', enrollmentController.getQuiz);
router.post('/:id/modules/:moduleId/quiz/attempts', quizAttemptValidator, validate, enrollmentController.submitQuizAttempt);
router.get('/:id/modules/:moduleId/quiz/attempts', enrollmentController.listQuizAttempts);

// Final project
router.get('/:id/project', enrollmentController.getProject);
router.post('/:id/project/submissions', projectSubmissionValidator, validate, enrollmentController.submitProject);

export default router;
