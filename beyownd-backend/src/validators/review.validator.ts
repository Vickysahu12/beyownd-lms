// src/validators/review.validator.ts
// Review decision ki FORMAT validation. Rubric ke against score check
// (har criterion, max score) service karti hai - wahan rubric pata hai.

import { body, query } from 'express-validator';

export const reviewQueueValidator = [
  query('status').optional().isIn(['pending', 'approved', 'changes_requested']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50').toInt(),
  query('cursor').optional().isMongoId().withMessage('Invalid cursor'),
];

export const reviewDecisionValidator = [
  body('decision').isIn(['approved', 'changes_requested']).withMessage('decision must be approved or changes_requested'),
  body('rubricScores').isArray({ min: 1, max: 8 }).withMessage('Score every rubric criterion'),
  body('rubricScores.*.criterion').isString().trim().notEmpty().withMessage('criterion is required'),
  body('rubricScores.*.score').isFloat({ min: 0, max: 100 }).withMessage('score must be a number').toFloat(),
  body('feedback')
    .isString().withMessage('Feedback is required').bail()
    .trim()
    .isLength({ min: 10, max: 5000 }).withMessage('Feedback must be 10-5000 characters - tell the student why'),
];
