// src/routes/catalog.routes.ts
// Public - landing page aur course pages yahi se data lete hai.

import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller';
import { publicLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.use(publicLimiter);

router.get('/', catalogController.listCourses);
router.get('/:slug', catalogController.getCourse);
router.get('/:slug/cohorts', catalogController.getCohorts);
router.get('/:slug/preview/lessons/:lessonId', catalogController.getPreviewLesson);

export default router;
