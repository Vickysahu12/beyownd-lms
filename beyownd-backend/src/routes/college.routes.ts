// src/routes/college.routes.ts
// Autocomplete har keystroke pe call ho sakta hai - frontend debounce
// karega (~300ms), aur results Redis mein cached hai.

import { Router } from 'express';
import * as collegeController from '../controllers/college.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { collegeSearchValidator } from '../validators/user.validator';

const router = Router();

router.get('/', protect, collegeSearchValidator, validate, collegeController.search);

export default router;
