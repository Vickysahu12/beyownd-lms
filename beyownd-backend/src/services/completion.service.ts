// src/services/completion.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Course COMPLETE kab hota hai, aur certificate + completion letter kab
// milte hai.
//
// COMPLETE = saare modules complete + project mentor ne approve kiya
//   → enrollment.status 'completed' (sirf ek baar, conditional update)
//
// DOCUMENTS = completed + BATCH KHATAM (cohort.endDate) - decision D2.
//   Internship ki dates real honi chahiye: 8 hafte ka program 3 din mein
//   khatam karke certificate nahi milta. Isliye:
//   - batch khatam ho chuka → abhi issue
//   - abhi nahi → DELAYED job endDate pe (Redis mein, restart-safe)
//   - backup: hourly sweep (worker) - delayed job kisi wajah se kho jaye
//     to bhi koi completed student certificate ke bina nahi rehta
// issueCredential() idempotent hai, isliye teeno raaste milke bhi duplicate
// nahi banate.
// ────────────────────────────────────────────────────────────────────────

import { Types } from 'mongoose';
import Enrollment from '../models/enrollment.model';
import Cohort from '../models/cohort.model';
import Credential from '../models/credential.model';
import { getOutline } from './catalog.service';
import { computeModuleStates } from './enrollment.service';
import { issueCredential } from './credential.service';
import { enqueueCompletionDocuments } from '../jobs/queue';
import { logger } from '../utils/logger';

const COMPLETION_TYPES = ['completion_certificate', 'completion_letter'] as const;

// Batch end ke baad thoda buffer - timezone/clock skew pe kabhi early na chale
const END_BUFFER_MS = 60 * 1000;

export type CompletionOutcome = 'not_ready' | 'already_completed' | 'completed';

// Batch khatam? Hua to documents abhi, warna endDate pe delayed job
export const scheduleCompletionDocuments = async (enrollmentId: string, cohortEnd: Date) => {
  const waitMs = cohortEnd.getTime() + END_BUFFER_MS - Date.now();
  if (waitMs <= 0) {
    await issueCompletionDocuments(enrollmentId);
    return 'issued_now' as const;
  }
  await enqueueCompletionDocuments(enrollmentId, waitMs);
  logger.info({ enrollmentId, issueAt: new Date(Date.now() + waitMs) }, 'Completion documents scheduled for batch end');
  return 'scheduled' as const;
};

// Mentor approval ke baad call hota hai (aur admin actions se, Phase 5)
export const checkAndCompleteEnrollment = async (enrollmentId: string): Promise<CompletionOutcome> => {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) return 'not_ready';
  if (enrollment.status === 'completed') return 'already_completed';
  if (enrollment.status !== 'active' || enrollment.projectStatus !== 'approved') return 'not_ready';

  const states = computeModuleStates(await getOutline(String(enrollment.courseId)), enrollment);
  if (states.length === 0 || !states.every((s) => s.completed)) return 'not_ready';

  // Conditional - do parallel calls mein se sirf ek complete karta hai
  const marked = await Enrollment.updateOne(
    { _id: enrollment._id, status: 'active' },
    { $set: { status: 'completed', completedAt: new Date() } }
  );
  if (marked.modifiedCount === 0) return 'already_completed';

  const cohort = await Cohort.findById(enrollment.cohortId).select({ endDate: 1 });
  if (cohort) await scheduleCompletionDocuments(enrollmentId, cohort.endDate);
  logger.info({ enrollmentId }, 'Enrollment completed');
  return 'completed';
};

// Worker (delayed job / sweep) ya scheduleCompletionDocuments call karta hai.
// Khud bhi check karta hai - job galti se early chal jaye to bhi kabhi
// batch end se pehle certificate nahi.
export const issueCompletionDocuments = async (enrollmentId: string | Types.ObjectId) => {
  const enrollment = await Enrollment.findById(enrollmentId).select({ status: 1, cohortId: 1 });
  if (!enrollment || enrollment.status !== 'completed') return 'not_completed';

  const cohort = await Cohort.findById(enrollment.cohortId).select({ endDate: 1 });
  if (!cohort || Date.now() < cohort.endDate.getTime()) return 'batch_not_ended';

  for (const type of COMPLETION_TYPES) await issueCredential(enrollment._id, type);
  return 'issued';
};

// Hourly safety net: completed + batch khatam + documents missing
export const sweepCompletedEnrollments = async (limit = 500) => {
  const ended = await Cohort.find({ endDate: { $lte: new Date() } }).select({ _id: 1 }).limit(5000);
  if (ended.length === 0) return 0;

  const completed = await Enrollment.find({ status: 'completed', cohortId: { $in: ended.map((c) => c._id) } })
    .select({ _id: 1 })
    .limit(limit);

  // Kis enrollment ke kitne completion documents hai - EK query (N+1 nahi)
  const existing = await Credential.find({
    enrollmentId: { $in: completed.map((e) => e._id) },
    type: { $in: COMPLETION_TYPES },
  }).select({ enrollmentId: 1 });
  const counts = new Map<string, number>();
  for (const c of existing) counts.set(String(c.enrollmentId), (counts.get(String(c.enrollmentId)) ?? 0) + 1);

  let issued = 0;
  for (const e of completed) {
    if ((counts.get(String(e._id)) ?? 0) < COMPLETION_TYPES.length) {
      await issueCompletionDocuments(e._id);
      issued++;
    }
  }
  if (issued) logger.info({ issued }, 'Completion sweep issued missing documents');
  return issued;
};
