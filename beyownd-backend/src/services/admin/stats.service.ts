// src/services/admin/stats.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Admin dashboard ke numbers - business kaisa chal raha hai:
//   overview  → signups, paid students, revenue, active this week, alerts
//   funnel    → ek course mein students kahan tak pahunche / kahan ruke
//   colleges  → kis college se kitne students aur kitne paid
// Sab MongoDB aggregation - data DB ke andar hi count hota hai, Node mein
// hazaron documents load nahi hote.
// ────────────────────────────────────────────────────────────────────────

import { isValidObjectId, Types } from 'mongoose';
import User from '../../models/user.model';
import Enrollment, { EnrollmentStatus } from '../../models/enrollment.model';
import Payment from '../../models/payment.model';
import Credential from '../../models/credential.model';
import ProjectSubmission from '../../models/projectSubmission.model';
import Module from '../../models/module.model';
import Course from '../../models/course.model';
import { AppError } from '../../utils/AppError';

const DAY = 24 * 60 * 60 * 1000;

const countBy = async (model: typeof Enrollment | typeof Credential, field: string, match: Record<string, unknown> = {}) => {
  const rows = await (model as typeof Enrollment).aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
};

export const overview = async () => {
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [totalUsers, verifiedUsers, onboardedUsers, newThisWeek, enrollmentsByStatus, activeThisWeek, revenue, credentialsByType, pendingReviews, refundsToProcess] =
    await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isVerified: true }),
      User.countDocuments({ role: 'student', onboardingCompleted: true }),
      User.countDocuments({ role: 'student', createdAt: { $gte: weekAgo } }),
      countBy(Enrollment, 'status'),
      // Progress update hone pe enrollment.updatedAt badalta hai
      Enrollment.countDocuments({ status: 'active', updatedAt: { $gte: weekAgo } }),
      Payment.aggregate([{ $match: { status: { $in: ['paid', 'refunded'] } } }, { $group: { _id: '$status', paise: { $sum: '$amountPaise' }, count: { $sum: 1 } } }]),
      countBy(Credential, 'type', { status: 'issued' }),
      ProjectSubmission.countDocuments({ status: 'pending' }),
      Payment.countDocuments({ refundRequired: true }),
    ]);

  const paid = revenue.find((r) => r._id === 'paid');
  const refunded = revenue.find((r) => r._id === 'refunded');

  return {
    students: { total: totalUsers, verified: verifiedUsers, onboarded: onboardedUsers, newThisWeek },
    enrollments: { ...enrollmentsByStatus, activeThisWeek },
    revenue: {
      paidCount: paid?.count ?? 0,
      paidPaise: paid?.paise ?? 0,
      refundedCount: refunded?.count ?? 0,
      refundedPaise: refunded?.paise ?? 0,
    },
    documentsIssued: credentialsByType,
    // Admin ko turant dikhna chahiye - kaam pending hai
    alerts: { pendingReviews, refundsToProcess },
  };
};

// Ek course: enrolled → har module started/completed → project → certificate
export const funnel = async (courseId: string) => {
  if (!isValidObjectId(courseId) || !(await Course.exists({ _id: courseId }))) throw AppError.notFound('Course not found');
  const cid = new Types.ObjectId(courseId);
  const base = { courseId: cid, status: { $in: ['active', 'completed'] as EnrollmentStatus[] } };

  const [enrolled, modules, progressRows, projectRows, completed] = await Promise.all([
    Enrollment.countDocuments(base),
    Module.find({ courseId: cid }).sort({ order: 1 }).select({ title: 1, order: 1 }),
    Enrollment.aggregate([
      { $match: base },
      { $unwind: '$progress' },
      {
        $group: {
          _id: '$progress.moduleId',
          started: { $sum: 1 },
          completed: { $sum: { $cond: [{ $ifNull: ['$progress.completedAt', false] }, 1, 0] } },
        },
      },
    ]),
    Enrollment.aggregate([{ $match: base }, { $group: { _id: '$projectStatus', n: { $sum: 1 } } }]),
    Enrollment.countDocuments({ courseId: cid, status: 'completed' }),
  ]);

  const project = Object.fromEntries(projectRows.map((r) => [r._id, r.n])) as Record<string, number>;
  return {
    enrolled,
    modules: modules.map((m) => {
      const row = progressRows.find((r) => String(r._id) === String(m._id));
      return { id: String(m._id), order: m.order, title: m.title, started: row?.started ?? 0, completed: row?.completed ?? 0 };
    }),
    project: {
      submitted: (project.pending_review ?? 0) + (project.changes_requested ?? 0) + (project.approved ?? 0),
      approved: project.approved ?? 0,
    },
    completed,
  };
};

// College-wise: kitne students signup + kitne paid (active/completed)
export const colleges = async (limit = 50) =>
  User.aggregate([
    { $match: { role: 'student', 'profile.collegeId': { $exists: true } } },
    {
      $lookup: {
        from: 'enrollments',
        let: { uid: '$_id' },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', '$$uid'] }, { $in: ['$status', ['active', 'completed']] }] } } }, { $limit: 1 }],
        as: 'paid',
      },
    },
    {
      $group: {
        _id: '$profile.collegeId',
        college: { $first: '$profile.collegeName' },
        students: { $sum: 1 },
        paidStudents: { $sum: { $cond: [{ $gt: [{ $size: '$paid' }, 0] }, 1, 0] } },
      },
    },
    { $sort: { paidStudents: -1, students: -1 } },
    { $limit: Math.min(Math.max(1, limit), 200) },
    { $project: { _id: 0, collegeId: '$_id', college: 1, students: 1, paidStudents: 1 } },
  ]);
