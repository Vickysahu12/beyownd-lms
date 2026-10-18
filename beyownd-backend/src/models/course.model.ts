// src/models/course.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Course = jo hum bechte hai (website pe "Internship Program" naam se).
//   Course → Modules (order mein) → Lessons (order mein). Modules aur lessons
//   apne parent ko point karte hai (module.courseId) - course ke paas
//   modules ki list NAHI hoti (ek hi jagah sach, drift nahi hota).
// - Cohort = is course ka ek batch with real dates (cohort.model.ts).
// - `project` embedded hai - har course ka ek final project brief + rubric.
// - services/catalog.service.ts public catalog dikhata hai (sirf
//   `published`), Redis mein cached.
// - Design: docs/design/schemas.md §3.1
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export const COURSE_LEVELS = ['beginner', 'intermediate'] as const;

export interface IRubricCriterion {
  criterion: string;
  maxScore: number;
}

export interface ICourseProject {
  title: string;
  brief: string;
  rubric: IRubricCriterion[];
  passScorePercent: number;
}

export interface ICourse extends Document {
  title: string;
  slug: string;
  tagline?: string;
  description: string;
  thumbnailUrl?: string;
  level: (typeof COURSE_LEVELS)[number];
  skills: string[];
  durationWeeks: number;
  defaultPricePaise: number;
  project: ICourseProject;
  status: (typeof COURSE_STATUSES)[number];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ICourseProject>(
  {
    title: { type: String, required: true, trim: true, maxLength: 120 },
    brief: { type: String, required: true, maxLength: 10_000 },
    rubric: {
      type: [
        {
          _id: false,
          criterion: { type: String, required: true, trim: true, maxLength: 120 },
          maxScore: { type: Number, required: true, min: 1, max: 100 },
        },
      ],
      validate: {
        validator: (v: IRubricCriterion[]) => v.length >= 3 && v.length <= 8,
        message: 'Rubric needs 3-8 criteria',
      },
    },
    passScorePercent: { type: Number, default: 60, min: 1, max: 100 },
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, minLength: 5, maxLength: 100 },
    // URL mein use hota hai: /courses/full-stack-web-dev
    slug: { type: String, required: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    tagline: { type: String, trim: true, maxLength: 160 },
    description: { type: String, required: true, maxLength: 5000 },
    thumbnailUrl: { type: String, trim: true },
    level: { type: String, enum: COURSE_LEVELS, default: 'beginner' },
    // Certificate/verify page pe dikhte hai ("React, Node.js, MongoDB")
    skills: {
      type: [{ type: String, trim: true, maxLength: 40 }],
      validate: { validator: (v: string[]) => v.length <= 15, message: 'Max 15 skills' },
    },
    durationWeeks: { type: Number, required: true, min: 4, max: 12 },
    // Paise mein (59900 = ₹599) - float money kabhi exact nahi hota
    defaultPricePaise: { type: Number, required: true, min: 0 },
    project: { type: projectSchema, required: true },
    status: { type: String, enum: COURSE_STATUSES, default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Public catalog: "saare published courses, naye pehle"
courseSchema.index({ status: 1, createdAt: -1 });

const Course: Model<ICourse> = mongoose.model<ICourse>('Course', courseSchema);

export default Course;
