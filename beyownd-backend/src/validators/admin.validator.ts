// src/validators/admin.validator.ts
//
// Admin inputs ki FORMAT validation. Create = required fields, update =
// sab optional (jo bheja wahi validate). Business rules (publishable?,
// capacity >= seats?) services mein; Mongoose models last safety net hai.
// Controller matchedData() use karta hai - sirf yahan listed fields aage jaate hai.

import { body, query, ValidationChain } from 'express-validator';
import { COURSE_LEVELS, COURSE_STATUSES } from '../models/course.model';
import { LESSON_TYPES } from '../models/lesson.model';
import { COHORT_STATUSES } from '../models/cohort.model';
import { ENROLLMENT_STATUSES } from '../models/enrollment.model';

type Mode = 'create' | 'update';
const field = (mode: Mode, name: string) => (mode === 'create' ? body(name) : body(name).optional());

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// ---- Courses ----

const courseRules = (mode: Mode): ValidationChain[] => [
  field(mode, 'title').isString().trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
  field(mode, 'slug').isString().trim().toLowerCase().matches(SLUG).withMessage('Slug: lowercase letters, numbers and hyphens (e.g. full-stack-web-dev)'),
  body('tagline').optional().isString().trim().isLength({ max: 160 }),
  field(mode, 'description').isString().isLength({ min: 1, max: 5000 }).withMessage('Description is required (max 5000)'),
  body('thumbnailUrl').optional({ values: 'falsy' }).isURL({ protocols: ['https'], require_protocol: true }).withMessage('Thumbnail must be an https URL'),
  body('level').optional().isIn(COURSE_LEVELS),
  body('skills').optional().isArray({ max: 15 }),
  body('skills.*').isString().trim().isLength({ min: 1, max: 40 }),
  field(mode, 'durationWeeks').isInt({ min: 4, max: 12 }).withMessage('Duration must be 4-12 weeks').toInt(),
  field(mode, 'defaultPricePaise').isInt({ min: 0 }).withMessage('Price in paise (e.g. 59900 = ₹599)').toInt(),
  field(mode, 'project').isObject().withMessage('Project brief is required'),
  body('project.title').if(body('project').exists()).isString().trim().isLength({ min: 3, max: 120 }),
  body('project.brief').if(body('project').exists()).isString().isLength({ min: 10, max: 10000 }),
  body('project.rubric').if(body('project').exists()).isArray({ min: 3, max: 8 }).withMessage('Rubric needs 3-8 criteria'),
  body('project.rubric.*.criterion').isString().trim().isLength({ min: 2, max: 120 }),
  body('project.rubric.*.maxScore').isInt({ min: 1, max: 100 }).toInt(),
  body('project.passScorePercent').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const createCourseValidator = courseRules('create');
export const updateCourseValidator = [...courseRules('update'), body('status').optional().isIn(COURSE_STATUSES)];

// ---- Modules / lessons ----

const moduleRules = (mode: Mode): ValidationChain[] => [
  field(mode, 'title').isString().trim().isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('isFreePreview').optional().isBoolean().toBoolean(),
];
export const createModuleValidator = moduleRules('create');
export const updateModuleValidator = moduleRules('update');

const lessonRules = (mode: Mode): ValidationChain[] => [
  field(mode, 'title').isString().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3-120 characters'),
  body('type').optional().isIn(LESSON_TYPES),
  body('content').optional().isString().isLength({ max: 50000 }),
  body('videoYoutubeId').optional({ values: 'null' }).isString().matches(YOUTUBE_ID).withMessage('YouTube video ID is 11 characters (from youtube.com/watch?v=XXXXXXXXXXX)'),
  body('estimatedMinutes').optional().isInt({ min: 1, max: 120 }).toInt(),
];
export const createLessonValidator = lessonRules('create');
export const updateLessonValidator = lessonRules('update');

export const reorderValidator = (key: 'moduleIds' | 'lessonIds') => [
  body(key).isArray({ min: 1, max: 100 }).withMessage(`${key} must be a list`),
  body(`${key}.*`).isMongoId(),
];

export const quizValidator = [
  body('passPercent').optional().isInt({ min: 1, max: 100 }).toInt(),
  body('questions').isArray({ min: 3, max: 30 }).withMessage('A quiz needs 3-30 questions'),
  body('questions.*.prompt').isString().isLength({ min: 1, max: 2000 }),
  body('questions.*.type').optional().isIn(['single', 'multiple']),
  body('questions.*.options').isArray({ min: 2, max: 6 }).withMessage('2-6 options per question'),
  body('questions.*.options.*').isString().isLength({ min: 1, max: 500 }),
  body('questions.*.correctOptionIndexes').isArray({ min: 1, max: 6 }),
  body('questions.*.correctOptionIndexes.*').isInt({ min: 0, max: 5 }).toInt(),
  body('questions.*.explanation').optional().isString().isLength({ max: 2000 }),
  body('questions.*.points').optional().isInt({ min: 1, max: 10 }).toInt(),
];

// ---- Cohorts ----

const cohortRules = (mode: Mode): ValidationChain[] => [
  ...(mode === 'create' ? [body('courseId').isMongoId().withMessage('Select a course')] : []),
  field(mode, 'name').isString().trim().isLength({ min: 2, max: 60 }),
  field(mode, 'code').isString().trim().toUpperCase().matches(/^[A-Z0-9-]{3,20}$/).withMessage('Code: 3-20 capital letters, numbers, hyphens (e.g. FSWD-NOV26)'),
  field(mode, 'startDate').isISO8601().withMessage('startDate must be a date').toDate(),
  field(mode, 'endDate').isISO8601().withMessage('endDate must be a date').toDate(),
  field(mode, 'enrollOpensAt').isISO8601().toDate(),
  field(mode, 'enrollClosesAt').isISO8601().toDate(),
  field(mode, 'capacity').isInt({ min: 1, max: 100000 }).toInt(),
  field(mode, 'pricePaise').isInt({ min: 0 }).withMessage('Price in paise (e.g. 59900 = ₹599)').toInt(),
  body('status').optional().isIn(COHORT_STATUSES),
  body('communityLink').optional({ values: 'falsy' }).isURL({ protocols: ['https'], require_protocol: true }),
];
export const createCohortValidator = cohortRules('create');
export const updateCohortValidator = cohortRules('update');

// ---- Students / operations ----

export const listStudentsValidator = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('cohortId').optional().isMongoId(),
  query('status').optional().isIn(ENROLLMENT_STATUSES),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('cursor').optional().isMongoId(),
];

export const reasonValidator = [
  body('reason').isString().trim().isLength({ min: 5, max: 500 }).withMessage('Give a reason (5-500 characters) - it goes into the audit log'),
];

export const roleValidator = [body('role').isIn(['student', 'mentor', 'admin']).withMessage('role must be student, mentor or admin')];

export const listQueryCourseValidator = [query('courseId').optional().isMongoId()];
export const collegesQueryValidator = [query('limit').optional().isInt({ min: 1, max: 200 }).toInt()];
