// src/validators/user.validator.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Onboarding (PUT, sab required) aur profile update (PATCH, sab optional)
// ke rules - dono ek hi field list se bante hai, taaki rules kabhi alag na hon.
//
// MASS-ASSIGNMENT PROTECTION: controller `matchedData()` use karta hai -
// sirf yahan define kiye fields service tak jaate hai. Koi
// { role: 'admin', onboardingCompleted: true } bheje to woh chupchap drop.
//
// Phone normalize hota hai: "098765 43210", "+91 98765-43210",
// "919876543210" sab → "+919876543210" (E.164 - WhatsApp API isi format
// mein maangta hai).
// ────────────────────────────────────────────────────────────────────────

import { body, query, ValidationChain } from 'express-validator';
import {
  DEGREES, CURRENT_YEARS, GOALS, SKILL_LEVELS, HEARD_FROM, INTEREST_AREAS, INDIAN_STATES,
  CERTIFICATE_NAME_PATTERN, MAX_INTERESTS,
} from '../constants/profile';

type Mode = 'create' | 'update';

export const normalizeIndianPhone = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  let digits = raw.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return `+91${digits}`;
};

const thisYear = () => new Date().getFullYear();

const profileRules = (mode: Mode): ValidationChain[] => {
  // create mode: field required. update mode: field optional (bheja to validate)
  const field = (name: string) => (mode === 'create' ? body(name) : body(name).optional());

  return [
    field('certificateName')
      .isString().withMessage('Name on certificate is required').bail()
      .trim()
      .isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters').bail()
      .matches(CERTIFICATE_NAME_PATTERN).withMessage("Enter your name in English letters, as it should appear on the certificate"),

    field('phone')
      .isString().withMessage('Phone number is required').bail()
      .customSanitizer(normalizeIndianPhone)
      .matches(/^\+91[6-9]\d{9}$/).withMessage('Enter a valid 10-digit Indian mobile number'),

    field('college')
      .isString().withMessage('College is required').bail()
      .trim()
      .isLength({ min: 3, max: 150 }).withMessage('College name must be 3-150 characters').bail()
      .matches(/\p{L}/u).withMessage('Enter a valid college name'),

    field('degree').isIn(DEGREES).withMessage('Select a valid degree'),

    body('degreeOther')
      .optional()
      .isString().trim()
      .isLength({ min: 2, max: 60 }).withMessage('Degree must be 2-60 characters'),
    body('degreeOther').custom((value, { req }) => {
      if (req.body.degree === 'other' && !value) throw new Error('Please enter your degree');
      return true;
    }),

    field('branch')
      .isString().withMessage('Branch is required').bail()
      .trim()
      .isLength({ min: 2, max: 60 }).withMessage('Branch must be 2-60 characters'),

    field('currentYear').isIn(CURRENT_YEARS).withMessage('Select your current year'),

    field('graduationYear')
      .isInt({ min: thisYear() - 6, max: thisYear() + 6 }).withMessage('Enter a valid graduation year')
      .toInt(),

    field('city')
      .isString().withMessage('City is required').bail()
      .trim()
      .isLength({ min: 2, max: 60 }).withMessage('City must be 2-60 characters').bail()
      .matches(/^[\p{L}\p{M} .'-]+$/u).withMessage('Enter a valid city name'),

    field('state').isIn(INDIAN_STATES).withMessage('Select a valid state'),

    field('goal').isIn(GOALS).withMessage('Select your goal'),

    body('certificateNeededBy')
      .optional({ values: 'falsy' })
      .isString()
      .matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Use the format YYYY-MM').bail()
      .custom((value: string) => {
        const year = Number(value.slice(0, 4));
        if (year < thisYear() - 1 || year > thisYear() + 3) throw new Error('Enter a realistic month');
        return true;
      }),

    field('interestedTracks')
      .isArray({ min: 1, max: MAX_INTERESTS }).withMessage(`Pick 1-${MAX_INTERESTS} areas`).bail()
      .customSanitizer((values: string[]) => [...new Set(values)]),
    body('interestedTracks.*').isIn(INTEREST_AREAS).withMessage('Invalid interest area'),

    field('skillLevel').isIn(SKILL_LEVELS).withMessage('Select your current level'),

    field('heardFrom').isIn(HEARD_FROM).withMessage('Select how you heard about us'),

    body('heardFromOther')
      .optional()
      .isString().trim()
      .isLength({ min: 2, max: 60 }).withMessage('Must be 2-60 characters'),
    body('heardFromOther').custom((value, { req }) => {
      if (req.body.heardFrom === 'other' && !value) throw new Error('Please tell us where you heard about us');
      return true;
    }),

    body('referralCode')
      .optional({ values: 'falsy' })
      .isString().trim()
      .matches(/^[A-Za-z0-9_-]{3,30}$/).withMessage('Invalid referral code')
      .toUpperCase(),
  ];
};

export const onboardingValidator = profileRules('create');

export const updateProfileValidator = [
  body().custom((value) => {
    if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
      throw new Error('Nothing to update');
    }
    return true;
  }),
  ...profileRules('update'),
];

export const collegeSearchValidator = [
  query('q')
    .isString().withMessage('Search text is required').bail()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Type at least 2 characters'),
];
