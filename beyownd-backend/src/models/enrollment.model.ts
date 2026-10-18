// src/models/enrollment.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - System ka CENTER: ek student ka ek cohort mein hona. Progress, quiz
//   attempts, project, payment, certificates - sab isse latakte hai.
// - Phase 3 mein POST /enrollments `pending_payment` banayega; payment
//   confirm hone pe `active`. Tab tak tests/seed script seedha active banate hai.
// - `progress` EMBEDDED hai: har module ki ek entry (course mein ~10
//   modules → chhota, bounded array). Entries lazily bante hai - jab student
//   us module mein pehla lesson complete kare.
// - Kaunsa module unlocked hai yeh STORE nahi hota - progress se har baar
//   compute hota hai (services/enrollment.service.ts). Stored "current
//   module" field real progress se drift kar sakta tha.
// - Design: docs/design/schemas.md §4.2
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const ENROLLMENT_STATUSES = ['pending_payment', 'active', 'completed', 'cancelled', 'refunded'] as const;
export const PROJECT_STATUSES = ['not_submitted', 'pending_review', 'changes_requested', 'approved'] as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface IModuleProgress {
  moduleId: Types.ObjectId;
  completedLessonIds: Types.ObjectId[];
  quizPassed: boolean;
  bestQuizScorePercent: number;
  completedAt?: Date;
}

export interface IEnrollment extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  cohortId: Types.ObjectId;
  status: EnrollmentStatus;
  progress: IModuleProgress[];
  projectStatus: (typeof PROJECT_STATUSES)[number];
  activatedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const moduleProgressSchema = new Schema<IModuleProgress>(
  {
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    completedLessonIds: { type: [Schema.Types.ObjectId], default: [] },
    quizPassed: { type: Boolean, default: false },
    bestQuizScorePercent: { type: Number, default: 0 },
    completedAt: { type: Date },
  },
  { _id: false }
);

const enrollmentSchema = new Schema<IEnrollment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalized - "my courses" bina cohort join ke
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    status: { type: String, enum: ENROLLMENT_STATUSES, default: 'pending_payment' },
    progress: { type: [moduleProgressSchema], default: [] },
    projectStatus: { type: String, enum: PROJECT_STATUSES, default: 'not_submitted' },
    activatedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Ek batch mein do baar enroll nahi
enrollmentSchema.index({ userId: 1, cohortId: 1 }, { unique: true });
// "Meri enrollments"
enrollmentSchema.index({ userId: 1, status: 1 });
// Admin: "is batch ke students"
enrollmentSchema.index({ cohortId: 1, status: 1 });
// Review queue (Phase 3)
enrollmentSchema.index({ status: 1, projectStatus: 1, updatedAt: 1 });

const Enrollment: Model<IEnrollment> = mongoose.model<IEnrollment>('Enrollment', enrollmentSchema);

export default Enrollment;
