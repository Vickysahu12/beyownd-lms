// src/routes/asset.routes.ts
// /api/assets/:name - lesson images + widgets (public, immutable cache).
// Upload admin routes mein hai (POST /api/admin/assets).

import { Router } from 'express';
import * as assetController from '../controllers/asset.controller';
import { assetLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();
router.get('/:name', assetLimiter, assetController.serve);

export default router;
