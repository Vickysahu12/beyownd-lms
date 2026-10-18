// src/models/cohort.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Cohort = ek course ka ek batch with REAL dates ("Nov 2026: Nov 10 –
//   Dec 22"). Yahi dates offer letter / certificate pe chhapti hai.
// - Students cohort mein enroll karte hai (enrollment.cohortId).
// - Lessons `startDate` se khulte hai (decision D10), certificate
//   `endDate` ke baad issue hota hai (D2).
// - `seatsTaken` live count NAHI hota - payment pe atomic $inc (Phase 3):
//   updateOne({ _id, seatsTaken: { $lt: capacity } }, { $inc: { seatsTaken: 1 } })
//   → 50 log ek saath last seat ke liye pay karein to sirf ek jeetega.
// - Price cohort pe hai (D5) - early-bird / festival batches possible.
// - Design: docs/design/schemas.md §4.1
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const COHORT_STATUSES = ['scheduled', 'open', 'running', 'completed', 'cancelled'] as const;

export interface ICohort extends Document {
  courseId: Types.ObjectId;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  enrollOpensAt: Date;
  enrollClosesAt: Date;
  capacity: number;
  seatsTaken: number;
  pricePaise: number;
  status: (typeof COHORT_STATUSES)[number];
  communityLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cohortSchema = new Schema<ICohort>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    name: { type: String, required: true, trim: true, maxLength: 60 },
    // Letters pe chhapta hai, e.g. FSWD-NOV26
    code: { type: String, required: true, unique: true, uppercase: true, match: /^[A-Z0-9-]{3,20}$/ },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    enrollOpensAt: { type: Date, required: true },
    enrollClosesAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1 },
    seatsTaken: { type: Number, default: 0, min: 0 },
    pricePaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: COHORT_STATUSES, default: 'scheduled' },
    // Sirf paid students ko dikhta hai
    communityLink: { type: String, trim: true },
  },
  { timestamps: true }
);

cohortSchema.pre('validate', function () {
  if (this.endDate <= this.startDate) throw new Error('Cohort endDate must be after startDate');
  if (this.enrollClosesAt <= this.enrollOpensAt) throw new Error('Enrollment must close after it opens');
});

// "Is course ke open batches, jaldi shuru hone wale pehle"
cohortSchema.index({ courseId: 1, status: 1, startDate: 1 });

const Cohort: Model<ICohort> = mongoose.model<ICohort>('Cohort', cohortSchema);

export default Cohort;
