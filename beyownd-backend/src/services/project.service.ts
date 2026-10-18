// src/services/project.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Course ka final project: brief + rubric dikhana, student ka submission
// lena (GitHub repo + live link). Mentor review Phase 3 mein (review queue).
//
// RULES:
// - Project tabhi khulta hai jab saare modules complete ho (MODULES_INCOMPLETE).
// - Ek time pe sirf EK pending submission. "changes requested" ke baad
//   resubmit = naya version. Approved ke baad submit nahi.
//
// DOUBLE-SUBMIT SAFETY: enrollment.projectStatus ek atomic GATE hai -
//   updateOne({ projectStatus: { $in: [not_submitted, changes_requested] } },
//             { $set: { projectStatus: 'pending_review' } })
// Do parallel submits mein se sirf ek ko match milta hai; doosre ko 409.
// Submission insert fail ho to gate wapas khol dete hai (stuck nahi rehta).
// Backup: { enrollmentId, version } unique index.
// ────────────────────────────────────────────────────────────────────────

import { Types } from 'mongoose';
import Course from '../models/course.model';
import Enrollment, { IEnrollment } from '../models/enrollment.model';
import ProjectSubmission, { IProjectSubmission } from '../models/projectSubmission.model';
import { AppError } from '../utils/AppError';
import { getOutline } from './catalog.service';
import { loadOwnEnrollment, computeModuleStates, ACCESSIBLE_STATUSES } from './enrollment.service';

export interface SubmissionInput {
  repoUrl: string;
  liveUrl?: string;
  notes?: string;
}

const OPEN_FOR_SUBMISSION: IEnrollment['projectStatus'][] = ['not_submitted', 'changes_requested'];

const toSubmissionResponse = (s: IProjectSubmission) => ({
  id: String(s._id),
  version: s.version,
  repoUrl: s.repoUrl,
  liveUrl: s.liveUrl ?? null,
  notes: s.notes ?? null,
  status: s.status,
  submittedAt: s.createdAt,
  // reviewerId student ko nahi dikhate - sirf feedback aur scores
  review: s.review
    ? {
        rubricScores: s.review.rubricScores.map((r) => ({ criterion: r.criterion, score: r.score })),
        totalPercent: s.review.totalPercent,
        feedback: s.review.feedback,
        decidedAt: s.review.decidedAt,
      }
    : null,
});

export const getProject = async (enrollmentId: string, userId: string) => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  if (!ACCESSIBLE_STATUSES.includes(enrollment.status)) {
    throw AppError.forbidden('Your enrollment is not active', 'ENROLLMENT_NOT_ACTIVE');
  }

  const [course, outline, submissions] = await Promise.all([
    Course.findById(enrollment.courseId).select({ project: 1 }),
    getOutline(String(enrollment.courseId)),
    ProjectSubmission.find({ enrollmentId: enrollment._id }).sort({ version: -1 }),
  ]);
  if (!course) throw AppError.notFound('Course not found');

  const states = computeModuleStates(outline, enrollment);
  const modulesComplete = states.length > 0 && states.every((s) => s.completed);

  return {
    project: {
      title: course.project.title,
      brief: course.project.brief,
      rubric: course.project.rubric.map((r) => ({ criterion: r.criterion, maxScore: r.maxScore })),
      passScorePercent: course.project.passScorePercent,
    },
    projectStatus: enrollment.projectStatus,
    unlocked: modulesComplete,
    canSubmit: modulesComplete && OPEN_FOR_SUBMISSION.includes(enrollment.projectStatus),
    submissions: submissions.map(toSubmissionResponse),
  };
};

export const submitProject = async (enrollmentId: string, userId: string, input: SubmissionInput) => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  if (!ACCESSIBLE_STATUSES.includes(enrollment.status)) {
    throw AppError.forbidden('Your enrollment is not active', 'ENROLLMENT_NOT_ACTIVE');
  }

  const states = computeModuleStates(await getOutline(String(enrollment.courseId)), enrollment);
  if (states.length === 0 || !states.every((s) => s.completed)) {
    throw AppError.forbidden('Complete all modules before submitting the project', 'MODULES_INCOMPLETE');
  }

  // Atomic gate - sirf ek request isse paar kar sakti hai
  const previousStatus = enrollment.projectStatus;
  const gate = await Enrollment.updateOne(
    { _id: enrollment._id, projectStatus: { $in: OPEN_FOR_SUBMISSION } },
    { $set: { projectStatus: 'pending_review' } }
  );
  if (gate.modifiedCount === 0) {
    const current = await Enrollment.findById(enrollment._id).select({ projectStatus: 1 });
    if (current?.projectStatus === 'approved') {
      throw AppError.conflict('Your project is already approved', 'PROJECT_ALREADY_APPROVED');
    }
    throw AppError.conflict('Your previous submission is still waiting for review', 'SUBMISSION_PENDING');
  }

  try {
    const last = await ProjectSubmission.findOne({ enrollmentId: enrollment._id }).sort({ version: -1 }).select({ version: 1 });
    const submission = await ProjectSubmission.create({
      enrollmentId: enrollment._id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      cohortId: enrollment.cohortId,
      version: (last?.version ?? 0) + 1,
      repoUrl: input.repoUrl,
      liveUrl: input.liveUrl,
      notes: input.notes,
    });
    return { projectStatus: 'pending_review' as const, submission: toSubmissionResponse(submission) };
  } catch (err) {
    // Insert fail hua - gate wapas kholo, warna student hamesha "pending" mein atka rahega
    await Enrollment.updateOne(
      { _id: enrollment._id as Types.ObjectId, projectStatus: 'pending_review' },
      { $set: { projectStatus: previousStatus } }
    );
    throw err;
  }
};
