// src/models/credential.model.ts
//
// ── HOW THIS FILE CONNECTS TO THE REST OF THE APP ──────────────────────────
// - Offer letter, completion certificate, completion letter - wahi cheez jo
//   business bechta hai. services/credential.service.ts banata hai,
//   jobs/document.processor.ts PDF banata hai, public /verify isse padhta hai.
// - `credentialId` PUBLIC hai (BYD-26-7KQ4-M9XA) - PDF + QR code pe chhapta
//   hai. Random, guess nahi ho sakta.
// - `snapshot` = issue ke time ka naam, college, course, batch dates, issuer.
//   Baad mein student profile ya course badle - document NAHI badalta.
// - IMMUTABLE BY CODE: neeche hooks snapshot / type / IDs ko update hone se
//   rokte hai. Sirf status, pdfKey aur revocation fields badal sakte hai.
// - Unique { enrollmentId, type } - PDF job do baar chale ya do requests
//   ek saath aaye, ek enrollment ka ek hi offer letter.
// - Design: docs/design/schemas.md §6.1
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const CREDENTIAL_TYPES = ['offer_letter', 'completion_certificate', 'completion_letter'] as const;
export const CREDENTIAL_STATUSES = ['generating', 'issued', 'revoked'] as const;

export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export interface ICredentialSnapshot {
  studentName: string;
  collegeName: string;
  courseTitle: string;
  skills: string[];
  cohortName: string;
  cohortCode: string;
  startDate: Date;
  endDate: Date;
  durationWeeks: number;
  issuedAt: Date;
  issuer: {
    legalName: string;
    registrationNo: string;
    address: string;
    email: string;
    signatoryName: string;
    signatoryTitle: string;
    brand: string;
    programName: string;
  };
}

export interface ICredential extends Document {
  credentialId: string;
  type: CredentialType;
  userId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  courseId: Types.ObjectId;
  cohortId: Types.ObjectId;
  snapshot: ICredentialSnapshot;
  pdfKey?: string;
  status: (typeof CREDENTIAL_STATUSES)[number];
  revokedAt?: Date;
  revokedReason?: string;
  revokedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const snapshotSchema = new Schema<ICredentialSnapshot>(
  {
    studentName: { type: String, required: true },
    collegeName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    skills: { type: [String], default: [] },
    cohortName: { type: String, required: true },
    cohortCode: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    durationWeeks: { type: Number, required: true },
    issuedAt: { type: Date, required: true },
    issuer: {
      legalName: { type: String, required: true },
      registrationNo: { type: String, required: true },
      address: { type: String, required: true },
      email: { type: String, required: true },
      signatoryName: { type: String, required: true },
      signatoryTitle: { type: String, required: true },
      brand: { type: String, required: true },
      programName: { type: String, required: true },
    },
  },
  { _id: false }
);

const credentialSchema = new Schema<ICredential>(
  {
    credentialId: { type: String, required: true, unique: true },
    type: { type: String, enum: CREDENTIAL_TYPES, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    snapshot: { type: snapshotSchema, required: true },
    pdfKey: { type: String },
    status: { type: String, enum: CREDENTIAL_STATUSES, default: 'generating' },
    revokedAt: { type: Date },
    revokedReason: { type: String, maxLength: 500 },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// ---- IMMUTABILITY ----
// Sirf yeh fields kabhi badal sakte hai. Baaki (snapshot, type, IDs) ek baar
// likhe gaye to hamesha ke liye.
const MUTABLE_FIELDS = new Set(['status', 'pdfKey', 'revokedAt', 'revokedReason', 'revokedBy', 'updatedAt']);

const assertOnlyMutableFields = (update: Record<string, unknown> | null) => {
  if (!update) return;
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith('$')) {
      // $set, $unset, $inc... ke andar ke fields check karo
      if (value && typeof value === 'object') assertOnlyMutableFields(value as Record<string, unknown>);
      continue;
    }
    const root = key.split('.')[0];
    if (!MUTABLE_FIELDS.has(root)) {
      throw new Error(`Credential field "${key}" is immutable once issued`);
    }
  }
};

credentialSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function () {
  assertOnlyMutableFields(this.getUpdate() as Record<string, unknown> | null);
});

credentialSchema.pre('save', function () {
  if (this.isNew) return;
  const changed = this.modifiedPaths().filter((p) => !MUTABLE_FIELDS.has(p.split('.')[0]));
  if (changed.length) throw new Error(`Credential fields are immutable once issued: ${changed.join(', ')}`);
});

// Ek enrollment ka ek hi document har type ka
credentialSchema.index({ enrollmentId: 1, type: 1 }, { unique: true });
// "Mere documents"
credentialSchema.index({ userId: 1, createdAt: -1 });
// Worker startup recovery: atke hue 'generating' documents
credentialSchema.index({ status: 1, createdAt: 1 });

const Credential: Model<ICredential> = mongoose.model<ICredential>('Credential', credentialSchema);

export default Credential;
