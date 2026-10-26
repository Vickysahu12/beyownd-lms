// src/services/admin/operations.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Admin ke "operations" kaam: batches (cohorts), students dhoondhna aur
// unki poori detail, refund mark karna, certificate revoke/reissue, aur
// kisi ko mentor/admin banana.
//
// Har action jo paise ya trust ko chhoota hai → audit log (kisne, kab, kya).
//
// ROLE CHANGE: role JWT mein hota hai - isliye role badalte hi us user ke
// saare sessions revoke (dobara login karna padega). Purana access token
// max 15 min chalega (protect stateless hai - Phase 0 decision).
// Admin khud ka role nahi badal sakta - galti se apne aap ko lock out na kare.
// ────────────────────────────────────────────────────────────────────────

import { isValidObjectId, Types } from 'mongoose';
import Cohort, { ICohort } from '../../models/cohort.model';
import Course from '../../models/course.model';
import User from '../../models/user.model';
import Enrollment from '../../models/enrollment.model';
import Payment from '../../models/payment.model';
import Credential from '../../models/credential.model';
import ProjectSubmission from '../../models/projectSubmission.model';
import { AppError } from '../../utils/AppError';
import { writeAudit } from '../../utils/audit.util';
import { invalidate, cacheKeys } from '../../utils/cache';
import { normalizeCredentialId } from '../../utils/credentialId.util';
import { enqueuePdf } from '../../jobs/queue';
import { markRefunded } from '../payment.service';
import { issueCredential, verifyCacheKey, listMyCredentials } from '../credential.service';
import { issueCompletionDocuments } from '../completion.service';
import { listMyEnrollments } from '../enrollment.service';
import { revokeAllSessions } from '../session.service';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertId = (id: string, what: string) => {
  if (!isValidObjectId(id)) throw AppError.notFound(`${what} not found`);
};

// ---- Cohorts (batches) ----

export type CohortInput = Partial<
  Pick<ICohort, 'name' | 'code' | 'startDate' | 'endDate' | 'enrollOpensAt' | 'enrollClosesAt' | 'capacity' | 'pricePaise' | 'status' | 'communityLink'>
> & { courseId?: string };

const clearCohortCaches = async (courseId: Types.ObjectId | string) => {
  const course = await Course.findById(courseId).select({ slug: 1 });
  await invalidate(cacheKeys.courseCohorts(String(courseId)), cacheKeys.publishedCourses(), ...(course ? [cacheKeys.courseBySlug(course.slug)] : []));
};

export const listCohorts = async (courseId?: string) => {
  const filter = courseId && isValidObjectId(courseId) ? { courseId } : {};
  const cohorts = await Cohort.find(filter).sort({ startDate: -1 }).limit(200);
  const counts = await Enrollment.aggregate([
    { $match: { cohortId: { $in: cohorts.map((c) => c._id) } } },
    { $group: { _id: { cohortId: '$cohortId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  return cohorts.map((c) => {
    const byStatus: Record<string, number> = {};
    for (const r of counts.filter((r) => String(r._id.cohortId) === String(c._id))) byStatus[r._id.status] = r.n;
    return { ...c.toObject(), id: String(c._id), seatsLeft: Math.max(0, c.capacity - c.seatsTaken), enrollments: byStatus };
  });
};

export const createCohort = async (actorId: string, input: CohortInput) => {
  if (!input.courseId || !isValidObjectId(input.courseId) || !(await Course.exists({ _id: input.courseId }))) {
    throw AppError.notFound('Course not found');
  }
  try {
    const cohort = await Cohort.create(input);
    await writeAudit(actorId, 'cohort.create', 'Cohort', cohort._id, { code: cohort.code, pricePaise: cohort.pricePaise });
    await clearCohortCaches(cohort.courseId);
    return cohort;
  } catch (err: any) {
    if (err?.code === 11000) throw AppError.conflict('A batch with this code already exists', 'CODE_TAKEN');
    throw err;
  }
};

export const updateCohort = async (actorId: string, cohortId: string, input: CohortInput) => {
  assertId(cohortId, 'Batch');
  const cohort = await Cohort.findById(cohortId);
  if (!cohort) throw AppError.notFound('Batch not found');

  const { courseId: _ignored, ...changes } = input; // a batch never moves to another course
  if (changes.capacity !== undefined && changes.capacity < cohort.seatsTaken) {
    throw AppError.badRequest(`Capacity can't be below the ${cohort.seatsTaken} seats already taken`, 'CAPACITY_BELOW_SEATS');
  }

  // Before/after sirf un fields ka jo sach mein badle - audit mein
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    const old = cohort.get(key);
    if (String(old) !== String(value)) {
      before[key] = old;
      after[key] = value;
    }
  }

  cohort.set(changes);
  try {
    await cohort.save();
  } catch (err: any) {
    if (err?.code === 11000) throw AppError.conflict('A batch with this code already exists', 'CODE_TAKEN');
    throw err;
  }

  if (Object.keys(after).length) {
    const action = 'pricePaise' in after ? 'cohort.update_price' : 'cohort.update';
    await writeAudit(actorId, action, 'Cohort', cohort._id, { before, after });
  }
  await clearCohortCaches(cohort.courseId);
  return cohort;
};

// ---- Students ----

export interface StudentQuery {
  q?: string;
  cohortId?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

export const listStudents = async ({ q, cohortId, status, limit = 20, cursor }: StudentQuery) => {
  const pageSize = Math.min(Math.max(1, limit), 50);
  const filter: Record<string, unknown> = {};

  // Batch/status filter → pehle enrollments se user IDs
  if (cohortId || status) {
    const enrollmentFilter: Record<string, unknown> = {};
    if (cohortId && isValidObjectId(cohortId)) enrollmentFilter.cohortId = cohortId;
    if (status) enrollmentFilter.status = status;
    filter._id = { $in: await Enrollment.distinct('userId', enrollmentFilter) };
  }
  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { 'profile.collegeName': rx }, { 'profile.certificateName': rx }];
  }
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { ...((filter._id) ?? {}), $lt: new Types.ObjectId(cursor) };
  }

  const users = await User.find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .select({ name: 1, email: 1, role: 1, isVerified: 1, onboardingCompleted: 1, profile: 1, createdAt: 1 });
  const page = users.slice(0, pageSize);

  const enrollmentCounts = await Enrollment.aggregate([
    { $match: { userId: { $in: page.map((u) => u._id) } } },
    { $group: { _id: { userId: '$userId', status: '$status' }, n: { $sum: 1 } } },
  ]);

  return {
    items: page.map((u) => {
      const enrollments: Record<string, number> = {};
      for (const r of enrollmentCounts.filter((r) => String(r._id.userId) === String(u._id))) enrollments[r._id.status] = r.n;
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        isVerified: u.isVerified,
        onboardingCompleted: u.onboardingCompleted,
        certificateName: u.profile?.certificateName ?? null,
        college: u.profile?.collegeName ?? null,
        phone: u.profile?.phone ?? null,
        enrollments,
        joinedAt: u.createdAt,
      };
    }),
    nextCursor: users.length > pageSize ? String(page[page.length - 1]._id) : null,
  };
};

export const getStudent = async (userId: string) => {
  assertId(userId, 'Student');
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Student not found');

  const [enrollments, payments, credentials, submissions] = await Promise.all([
    listMyEnrollments(userId),
    Payment.find({ userId }).sort({ createdAt: -1 }).limit(50),
    listMyCredentials(userId),
    ProjectSubmission.find({ userId }).sort({ createdAt: -1 }).limit(20).select({ enrollmentId: 1, version: 1, status: 1, repoUrl: 1, createdAt: 1, review: 1 }),
  ]);

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      authProviders: user.authProviders,
      onboardingCompleted: user.onboardingCompleted,
      profile: user.profile ?? null,
      joinedAt: user.createdAt,
    },
    enrollments,
    payments: payments.map((p) => ({
      id: String(p._id),
      enrollmentId: String(p.enrollmentId),
      amountPaise: p.amountPaise,
      status: p.status,
      method: p.method ?? null,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId ?? null,
      refundRequired: p.refundRequired,
      paidAt: p.paidAt ?? null,
      createdAt: p.createdAt,
    })),
    credentials,
    submissions: submissions.map((s) => ({
      id: String(s._id),
      enrollmentId: String(s.enrollmentId),
      version: s.version,
      status: s.status,
      repoUrl: s.repoUrl,
      totalPercent: s.review?.totalPercent ?? null,
      submittedAt: s.createdAt,
    })),
  };
};

// ---- Refund (after refunding in the Razorpay dashboard) ----

export const refundEnrollment = async (actorId: string, enrollmentId: string, reason: string) => {
  assertId(enrollmentId, 'Enrollment');
  const payment = await Payment.findOne({ enrollmentId, status: 'paid' }).sort({ paidAt: -1 });
  if (!payment?.razorpayPaymentId) {
    throw AppError.conflict('No paid payment found for this enrollment', 'NO_PAID_PAYMENT');
  }
  // Same path as the refund.processed webhook: payment + enrollment + seat (transaction) → revoke documents
  const outcome = await markRefunded(payment.razorpayPaymentId);
  await writeAudit(actorId, 'enrollment.refund', 'Enrollment', enrollmentId, { reason, paymentId: payment.razorpayPaymentId, amountPaise: payment.amountPaise, outcome });
  return { outcome };
};

// ---- Credentials ----

export const revokeCredential = async (actorId: string, rawId: string, reason: string) => {
  const credentialId = normalizeCredentialId(rawId);
  if (!credentialId) throw AppError.notFound('Document not found', 'CREDENTIAL_NOT_FOUND');
  const updated = await Credential.findOneAndUpdate(
    { credentialId, status: { $ne: 'revoked' } },
    { $set: { status: 'revoked', revokedAt: new Date(), revokedReason: reason, revokedBy: new Types.ObjectId(actorId) } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    if (await Credential.exists({ credentialId })) throw AppError.conflict('This document is already revoked', 'ALREADY_REVOKED');
    throw AppError.notFound('Document not found', 'CREDENTIAL_NOT_FOUND');
  }
  await invalidate(verifyCacheKey(credentialId));
  await writeAudit(actorId, 'credential.revoke', 'Credential', updated._id, { credentialId, type: updated.type, reason });
  return { credentialId, status: updated.status, revokedAt: updated.revokedAt };
};

// Missing / stuck documents dobara: offer letter (agar activation ke baad
// issue fail hua tha), completion documents (agar due hai), aur 'generating'
// mein atke PDFs. Sab idempotent - extra copy kabhi nahi banti.
export const reissueDocuments = async (actorId: string, enrollmentId: string) => {
  assertId(enrollmentId, 'Enrollment');
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  if (!['active', 'completed'].includes(enrollment.status)) {
    throw AppError.conflict('Documents can only be issued for active or completed enrollments', 'ENROLLMENT_NOT_ACTIVE');
  }

  await issueCredential(enrollment._id, 'offer_letter');
  const completion = enrollment.status === 'completed' ? await issueCompletionDocuments(enrollment._id) : 'not_completed';

  const stuck = await Credential.find({ enrollmentId, status: 'generating' }).select({ credentialId: 1 });
  for (const c of stuck) await enqueuePdf(c.credentialId);

  await writeAudit(actorId, 'credential.reissue', 'Enrollment', enrollment._id, { requeued: stuck.length, completion });
  return { requeuedPdfs: stuck.length, completion };
};

// ---- Roles ----

export const setRole = async (actorId: string, userId: string, role: 'student' | 'mentor' | 'admin') => {
  assertId(userId, 'User');
  if (userId === actorId) throw AppError.badRequest("You can't change your own role", 'CANNOT_CHANGE_OWN_ROLE');
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  if (user.role === role) return { id: userId, role };

  const from = user.role;
  user.role = role;
  await user.save();
  await revokeAllSessions(userId); // new role → must log in again
  await writeAudit(actorId, 'user.set_role', 'User', userId, { from, to: role, email: user.email });
  return { id: userId, role };
};
