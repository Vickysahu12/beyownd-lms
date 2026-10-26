// src/routes/admin.routes.ts
// Sirf admin. Mentor ka kaam (project review) /api/review pe hai.
// Content editor, batches, students, operations, stats.

import express, { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import * as assets from '../controllers/asset.controller';
import { ASSET_LIMITS } from '../utils/assetStore.util';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import * as v from '../validators/admin.validator';

const router = Router();
router.use(protect, restrictTo('admin'));

// ---- Content ----
router.get('/courses', admin.listCourses);
router.post('/courses', v.createCourseValidator, validate, admin.createCourse);
router.get('/courses/:id', admin.getCourse);
router.patch('/courses/:id', v.updateCourseValidator, validate, admin.updateCourse);
router.post('/courses/:id/modules', v.createModuleValidator, validate, admin.addModule);
router.put('/courses/:id/modules/order', v.reorderValidator('moduleIds'), validate, admin.reorderModules);

router.patch('/modules/:id', v.updateModuleValidator, validate, admin.updateModule);
router.delete('/modules/:id', admin.deleteModule);
router.post('/modules/:id/lessons', v.createLessonValidator, validate, admin.addLesson);
router.put('/modules/:id/lessons/order', v.reorderValidator('lessonIds'), validate, admin.reorderLessons);
router.get('/modules/:id/quiz', admin.getQuiz);
router.put('/modules/:id/quiz', v.quizValidator, validate, admin.upsertQuiz);
router.delete('/modules/:id/quiz', admin.deleteQuiz);

router.post('/lessons/check', v.checkLessonValidator, validate, admin.checkLesson);
router.get('/lessons/:id', admin.getLesson);
router.patch('/lessons/:id', v.updateLessonValidator, validate, admin.updateLesson);
router.delete('/lessons/:id', admin.deleteLesson);

// Lesson images / widgets: raw file bytes in the body, ?filename=diagram.png
router.post('/assets', express.raw({ type: () => true, limit: ASSET_LIMITS.imageBytes + 1024 }), assets.upload);

// ---- Batches ----
router.get('/cohorts', v.listQueryCourseValidator, validate, admin.listCohorts);
router.post('/cohorts', v.createCohortValidator, validate, admin.createCohort);
router.patch('/cohorts/:id', v.updateCohortValidator, validate, admin.updateCohort);

// ---- Students ----
router.get('/students', v.listStudentsValidator, validate, admin.listStudents);
router.get('/students/:id', admin.getStudent);

// ---- Operations (all audit-logged) ----
router.post('/enrollments/:id/refund', v.reasonValidator, validate, admin.refundEnrollment);
router.post('/enrollments/:id/credentials/reissue', admin.reissueDocuments);
router.post('/credentials/:id/revoke', v.reasonValidator, validate, admin.revokeCredential);
router.patch('/users/:id/role', v.roleValidator, validate, admin.setRole);

// ---- Stats ----
router.get('/stats/overview', admin.overview);
router.get('/stats/funnel', v.listQueryCourseValidator, validate, admin.funnel);
router.get('/stats/colleges', v.collegesQueryValidator, validate, admin.colleges);

export default router;
