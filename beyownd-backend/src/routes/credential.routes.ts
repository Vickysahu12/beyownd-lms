// src/routes/credential.routes.ts
// /api/credentials (login), /api/verify (public), /api/files (signed link)

import { Router } from 'express';
import * as credentialController from '../controllers/credential.controller';
import { protect } from '../middlewares/auth.middleware';
import { publicLimiter } from '../middlewares/rateLimiter.middleware';

export const credentialRoutes = Router();
credentialRoutes.use(protect);
credentialRoutes.get('/', credentialController.listMine);
credentialRoutes.get('/:credentialId/download', credentialController.download);

// College / recruiter verify karte hai - cached + rate-limited
export const verifyRoutes = Router();
verifyRoutes.get('/:credentialId', publicLimiter, credentialController.verify);

// Signed, 5-minute download links (auth = HMAC signature in the URL)
export const fileRoutes = Router();
fileRoutes.get('/:folder/:file', publicLimiter, credentialController.file);
