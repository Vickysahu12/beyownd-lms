// src/models/projectSubmission.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Course ka final project (brief + rubric course.project mein) - student
//   GitHub repo + live link submit karta hai, mentor review karta hai (Phase 3).
// - `version` 1, 2, 3... - "changes requested" ke baad resubmit = naya version.
//   Purane versions + unke reviews history ke liye rehte hai.
// - Ek time pe sirf EK pending submission: enrollment.projectStatus ek
//   atomic "gate" hai (services/project.service.ts) - double submit nahi ho sakta.
// - `review` embedded - har submission ka max ek review.
// - Design: docs/design/schemas.md §4.4
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const SUBMISSION_STATUSES = ['pending', 'approved', 'changes_requested'] as const;

export interface IRubricScore {
  criterion: string;
  score: number;
}

export interface ISubmissionReview {
  reviewerId: Types.ObjectId;
  rubricScores: IRubricScore[];
  totalPercent: number;
  feedback: string;
  decidedAt: Date;
}

export interface IProjectSubmission extends Document {
  enrollmentId: Types.ObjectId;
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  cohortId: Types.ObjectId;
  version: number;
  repoUrl: string;
  liveUrl?: string;
  notes?: string;
  status: (typeof SUBMISSION_STATUSES)[number];
  review?: ISubmissionReview;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ISubmissionReview>(
  {
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rubricScores: [{ _id: false, criterion: { type: String, required: true }, score: { type: Number, required: true, min: 0 } }],
    totalPercent: { type: Number, required: true, min: 0, max: 100 },
    feedback: { type: String, required: true, maxLength: 5000 },
    decidedAt: { type: Date, required: true },
  },
  { _id: false }
);

const projectSubmissionSchema = new Schema<IProjectSubmission>(
  {
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    version: { type: Number, required: true, min: 1 },
    repoUrl: { type: String, required: true, maxLength: 300 },
    liveUrl: { type: String, maxLength: 300 },
    notes: { type: String, maxLength: 2000 },
    status: { type: String, enum: SUBMISSION_STATUSES, default: 'pending' },
    review: { type: reviewSchema },
  },
  { timestamps: true }
);

// Ek enrollment ka har version unique - race mein bhi duplicate version nahi
projectSubmissionSchema.index({ enrollmentId: 1, version: -1 }, { unique: true });
// Review queue (Phase 3): pending, purane pehle
projectSubmissionSchema.index({ status: 1, createdAt: 1 });

const ProjectSubmission: Model<IProjectSubmission> = mongoose.model<IProjectSubmission>(
  'ProjectSubmission',
  projectSubmissionSchema
);

export default ProjectSubmission;
