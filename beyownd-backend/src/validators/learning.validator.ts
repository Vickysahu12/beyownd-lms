// src/validators/learning.validator.ts
//
// Quiz answers aur project submission ki FORMAT validation. Grading,
// unlock, ownership - sab service mein; yahan sirf "shape sahi hai?".

import { body } from 'express-validator';

export const quizAttemptValidator = [
  body('answers')
    .isArray({ max: 50 }).withMessage('answers must be a list'),
  body('answers.*.questionId')
    .isMongoId().withMessage('Invalid question'),
  body('answers.*.selectedOptionIndexes')
    .isArray({ max: 6 }).withMessage('selectedOptionIndexes must be a list'),
  body('answers.*.selectedOptionIndexes.*')
    .isInt({ min: 0, max: 5 }).withMessage('Invalid option')
    .toInt(),
];

// GitHub repo URL: https://github.com/<owner>/<repo> (aage path optional).
// Sirf github.com - mentor ko ek hi jagah code dekhna pade, aur koi random
// link (ya phishing page) submit na ho.
const GITHUB_REPO = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}(\/.*)?$/;

export const projectSubmissionValidator = [
  body('repoUrl')
    .isString().withMessage('GitHub repository link is required').bail()
    .trim()
    .isLength({ max: 300 }).withMessage('Link is too long').bail()
    .matches(GITHUB_REPO).withMessage('Enter a GitHub repository link like https://github.com/you/project'),

  body('liveUrl')
    .optional({ values: 'falsy' })
    .isString().trim()
    .isLength({ max: 300 }).withMessage('Link is too long').bail()
    .isURL({ protocols: ['https'], require_protocol: true }).withMessage('Live link must start with https://'),

  body('notes')
    .optional({ values: 'falsy' })
    .isString().trim()
    .isLength({ max: 2000 }).withMessage('Notes can be at most 2000 characters'),
];
