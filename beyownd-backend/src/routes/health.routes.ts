// src/routes/health.routes.ts
import { Router } from 'express';
import * as healthController from '../controllers/health.controller';

const router = Router();

router.get('/', healthController.liveness);
router.get('/ready', healthController.readiness);

export default router;
