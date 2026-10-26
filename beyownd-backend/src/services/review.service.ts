// src/services/review.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Mentor (ya admin) ka project review: queue dekhna, ek submission kholna,
// decision dena (approve / changes requested) rubric scores + feedback ke saath.
//
// RULES:
// - Rubric ke HAR criterion ka score dena zaroori, 0..maxScore. Total %
//   server calculate karta hai (mentor ka bheja total trust nahi).
// - Pass score se kam pe APPROVE nahi ho sakta (SCORE_BELOW_PASS) -
//   certificate ka matlab "project quality bar cross kiya".
// - Feedback zaroori (min 10 chars) - student ko pata hona chahiye kyun.
// - Ek submission pe EK hi decision: conditional update (status 'pending'
//   se hi) - do mentors ek saath review karein to ek jeetega, doosre ko 409.
//
// TRANSACTION: submission decision + enrollment.projectStatus + audit log
// ek saath. Commit ke baad: approve → course completion check (certificate
// scheduling), aur student ko email.
// ────────────────────────────────────────────────────────────────────────

import mongoose, { isValidObjectId, Types } from 'mongoose';
import ProjectSubmission, { IProjectSubmission } from '../models/projectSubmission.model';
import Enrollment from '../models/enrollment.model';
import Course from '../models/course.model';
import Cohort from '../models/cohort.model';
import User from '../models/user.model';
import AuditLog from '../models/auditLog.model';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { enqueueReviewEmail } from '../jobs/queue';
import { checkAndCompleteEnrollment, CompletionOutcome } from './completion.service';

export type ReviewDecision = 'approved' | 'changes_requested';

export interface DecisionInput {
  decision: ReviewDecision;
  rubricScores: { criterion: string; score: number }[];
  feedback: string;
}

const QUEUE_LIMIT_MAX = 50;

// ---- Queue ----

export const listQueue = async (status: 'pending' | 'approved' | 'changes_requested', limit = 20, cursor?: string) => {
  const pageSize = Math.min(Math.max(1, limit), QUEUE_LIMIT_MAX);
  const filter: Record<string, unknown> = { status };
  // Cursor = last seen _id. Pending queue purane pehle (FIFO - jo pehle aaya
  // uska pehle review); reviewed lists naye pehle.
  const ascending = status === 'pending';
  if (cursor && isValidObjectId(cursor)) filter._id = ascending ? { $gt: cursor } : { $lt: cursor };

  const items = await ProjectSubmission.find(filter)
    .sort({ _id: ascending ? 1 : -1 })
    .limit(pageSize + 1);

  const page = items.slice(0, pageSize);
  // Students, courses, cohorts - ek-ek query mein (N+1 nahi)
  const [users, courses, cohorts] = await Promise.all([
    User.find({ _id: { $in: page.map((s) => s.userId) } }).select({ name: 1, profile: 1 }),
    Course.find({ _id: { $in: page.map((s) => s.courseId) } }).select({ title: 1 }),
    Cohort.find({ _id: { $in: page.map((s) => s.cohortId) } }).select({ name: 1, code: 1, endDate: 1 }),
  ]);
  const byId = <T extends { _id: unknown }>(list: T[]) => new Map(list.map((d) => [String(d._id), d]));
  const u = byId(users);
  const c = byId(courses);
  const h = byId(cohorts);

  return {
    items: page.map((s) => {
      const user = u.get(String(s.userId));
      const cohort = h.get(String(s.cohortId));
      return {
        id: String(s._id),
        version: s.version,
        status: s.status,
        submittedAt: s.createdAt,
        repoUrl: s.repoUrl,
        liveUrl: s.liveUrl ?? null,
        student: { name: user?.profile?.certificateName ?? user?.name ?? 'Unknown', college: user?.profile?.collegeName ?? null },
        course: { title: c.get(String(s.courseId))?.title ?? null },
        cohort: cohort ? { name: cohort.name, code: cohort.code, endDate: cohort.endDate } : null,
      };
    }),
    nextCursor: items.length > pageSize ? String(page[page.length - 1]._id) : null,
  };
};

// ---- One submission (with rubric + history) ----

const loadSubmission = async (submissionId: string): Promise<IProjectSubmission> => {
  if (!isValidObjectId(submissionId)) throw AppError.notFound('Submission not found');
  const submission = await ProjectSubmission.findById(submissionId);
  if (!submission) throw AppError.notFound('Submission not found');
  return submission;
};

export const getSubmission = async (submissionId: string) => {
  const submission = await loadSubmission(submissionId);
  const [course, user, history] = await Promise.all([
    Course.findById(submission.courseId).select({ title: 1, project: 1 }),
    User.findById(submission.userId).select({ name: 1, profile: 1 }),
    ProjectSubmission.find({ enrollmentId: submission.enrollmentId, _id: { $ne: submission._id } }).sort({ version: -1 }),
  ]);
  if (!course) throw AppError.notFound('Course not found');

  return {
    submission: {
      id: String(submission._id),
      version: submission.version,
      status: submission.status,
      repoUrl: submission.repoUrl,
      liveUrl: submission.liveUrl ?? null,
      notes: submission.notes ?? null,
      submittedAt: submission.createdAt,
      review: submission.review ?? null,
    },
    student: { name: user?.profile?.certificateName ?? user?.name ?? 'Unknown', college: user?.profile?.collegeName ?? null },
    project: {
      courseTitle: course.title,
      title: course.project.title,
      brief: course.project.brief,
      rubric: course.project.rubric.map((r) => ({ criterion: r.criterion, maxScore: r.maxScore })),
      passScorePercent: course.project.passScorePercent,
    },
    previousVersions: history.map((h) => ({
      id: String(h._id),
      version: h.version,
      status: h.status,
      repoUrl: h.repoUrl,
      submittedAt: h.createdAt,
      feedback: h.review?.feedback ?? null,
      totalPercent: h.review?.totalPercent ?? null,
    })),
  };
};

// ---- Decision ----

// Pure: rubric ke against scores check + total %. Har criterion exactly ek baar.
export const scoreAgainstRubric = (
  rubric: { criterion: string; maxScore: number }[],
  scores: { criterion: string; score: number }[]
) => {
  const given = new Map<string, number>();
  for (const s of scores) {
    if (given.has(s.criterion)) throw AppError.badRequest(`"${s.criterion}" was scored twice`, 'RUBRIC_INVALID');
    given.set(s.criterion, s.score);
  }
  const unknown = scores.find((s) => !rubric.some((r) => r.criterion === s.criterion));
  if (unknown) throw AppError.badRequest(`"${unknown.criterion}" is not in this project's rubric`, 'RUBRIC_INVALID');

  let earned = 0;
  let max = 0;
  const rubricScores = rubric.map((r) => {
    const score = given.get(r.criterion);
    if (score === undefined) throw AppError.badRequest(`Score missing for "${r.criterion}"`, 'RUBRIC_INVALID');
    if (score < 0 || score > r.maxScore) {
      throw AppError.badRequest(`"${r.criterion}" must be between 0 and ${r.maxScore}`, 'RUBRIC_INVALID');
    }
    earned += score;
    max += r.maxScore;
    return { criterion: r.criterion, score };
  });
  return { rubricScores, totalPercent: max === 0 ? 0 : Math.round((earned / max) * 100) };
};

export const decide = async (submissionId: string, reviewerId: string, input: DecisionInput) => {
  const submission = await loadSubmission(submissionId);
  if (submission.status !== 'pending') {
    throw AppError.conflict('This submission has already been reviewed', 'SUBMISSION_ALREADY_REVIEWED');
  }
  const course = await Course.findById(submission.courseId).select({ project: 1 });
  if (!course) throw AppError.notFound('Course not found');

  const { rubricScores, totalPercent } = scoreAgainstRubric(course.project.rubric, input.rubricScores);
  if (input.decision === 'approved' && totalPercent < course.project.passScorePercent) {
    throw AppError.badRequest(
      `A score of ${totalPercent}% is below the pass mark of ${course.project.passScorePercent}%. Request changes instead.`,
      'SCORE_BELOW_PASS'
    );
  }

  const review = {
    reviewerId: new Types.ObjectId(reviewerId),
    rubricScores,
    totalPercent,
    feedback: input.feedback,
    decidedAt: new Date(),
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Sirf 'pending' se - do mentors ek saath decide karein to ek hi jeetega
      const updated = await ProjectSubmission.findOneAndUpdate(
        { _id: submission._id, status: 'pending' },
        { $set: { status: input.decision, review } },
        { returnDocument: 'after', session }
      );
      if (!updated) {
        throw AppError.conflict('This submission has already been reviewed', 'SUBMISSION_ALREADY_REVIEWED');
      }
      await Enrollment.updateOne(
        { _id: submission.enrollmentId, projectStatus: 'pending_review' },
        { $set: { projectStatus: input.decision } },
        { session }
      );
      await AuditLog.create(
        [
          {
            actorId: review.reviewerId,
            action: 'submission.review',
            targetType: 'ProjectSubmission',
            targetId: submission._id,
            details: { decision: input.decision, totalPercent, version: submission.version, enrollmentId: submission.enrollmentId },
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // Commit ke BAAD - ye fail ho to decision undo nahi hota (log + retry/sweep)
  let completion: CompletionOutcome | null = null;
  if (input.decision === 'approved') {
    try {
      completion = await checkAndCompleteEnrollment(String(submission.enrollmentId));
    } catch (err) {
      logger.error({ err, enrollmentId: submission.enrollmentId }, 'Completion check failed after approval');
    }
  }
  try {
    await enqueueReviewEmail(String(submission._id));
  } catch (err) {
    logger.error({ err, submissionId: submission._id }, 'Could not enqueue review email');
  }

  return { submissionId: String(submission._id), decision: input.decision, totalPercent, completion };
};
