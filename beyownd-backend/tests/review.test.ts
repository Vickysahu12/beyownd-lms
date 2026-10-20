// tests/review.test.ts
// Phase 3C: mentor review queue + decision (transaction, rubric rules,
// audit log), course completion, and certificate timing (decision D2:
// documents only after the batch ends - immediately, via delayed job, or
// via the hourly sweep).

import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Enrollment from '../src/models/enrollment.model';
import ProjectSubmission from '../src/models/projectSubmission.model';
import Credential from '../src/models/credential.model';
import AuditLog from '../src/models/auditLog.model';
import Cohort from '../src/models/cohort.model';
import { getDocumentsQueue } from '../src/jobs/queue';
import { processDocumentJob } from '../src/jobs/document.processor';
import { issueCompletionDocuments, sweepCompletedEnrollments } from '../src/services/completion.service';
import { scoreAgainstRubric } from '../src/services/review.service';
import { sendReviewResultEmail } from '../src/utils/email.util';
import { createCourse, createCohort, createStudent, createEnrollment } from './helpers/fixtures';

jest.mock('../src/utils/email.util', () => ({
  ...jest.requireActual('../src/utils/email.util'),
  sendReviewResultEmail: jest.fn(),
  sendDocumentReadyEmail: jest.fn(),
}));
const mockedReviewEmail = sendReviewResultEmail as jest.MockedFunction<typeof sendReviewResultEmail>;

const oid = (doc: { _id: unknown }) => doc._id as Types.ObjectId;
type Auth = Record<string, string>;

const FULL = [
  { criterion: 'Features', score: 9 },
  { criterion: 'Code quality', score: 8 },
  { criterion: 'Deployment', score: 10 },
];
const LOW = [
  { criterion: 'Features', score: 3 },
  { criterion: 'Code quality', score: 3 },
  { criterion: 'Deployment', score: 3 },
];

// Student who finished both modules (no quizzes) and submitted the project.
// batchEnded: cohort that started 60 days ago (8-week batch → already over).
const submittedStudent = async ({ batchEnded = false } = {}) => {
  const { course, lessons } = await createCourse({ lessonsPerModule: [1, 1] });
  const cohort = await createCohort(oid(course), { startsInDays: batchEnded ? -60 : -1 });
  const student = await createStudent('student', { onboarded: true });
  const enrollment = await createEnrollment(oid(student.user), oid(course), oid(cohort), 'active');
  for (const l of lessons) {
    await request(app).post(`/api/enrollments/${enrollment._id}/lessons/${l._id}/complete`).set(student.auth).expect(200);
  }
  const sub = await request(app)
    .post(`/api/enrollments/${enrollment._id}/project/submissions`)
    .set(student.auth)
    .send({ repoUrl: 'https://github.com/ravi/job-board', liveUrl: 'https://job-board.vercel.app' })
    .expect(201);
  return { course, cohort, student, enrollment, submissionId: sub.body.submission.id as string };
};

const decide = (auth: Auth, submissionId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/review/submissions/${submissionId}/decision`).set(auth).send(body);

const approve = (auth: Auth, submissionId: string) =>
  decide(auth, submissionId, { decision: 'approved', rubricScores: FULL, feedback: 'Great work - clean code and deployed.' });

beforeEach(() => {
  mockedReviewEmail.mockReset();
  mockedReviewEmail.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────
describe('Rubric scoring (pure)', () => {
  const rubric = [
    { criterion: 'A', maxScore: 10 },
    { criterion: 'B', maxScore: 20 },
  ];
  it('computes the total from the rubric, not from the client', () => {
    expect(scoreAgainstRubric(rubric, [{ criterion: 'A', score: 5 }, { criterion: 'B', score: 20 }]).totalPercent).toBe(83);
  });
  it('rejects missing, unknown, duplicate and out-of-range scores', () => {
    expect(() => scoreAgainstRubric(rubric, [{ criterion: 'A', score: 5 }])).toThrow(/missing/);
    expect(() => scoreAgainstRubric(rubric, [{ criterion: 'A', score: 5 }, { criterion: 'B', score: 1 }, { criterion: 'C', score: 1 }])).toThrow(/not in/);
    expect(() => scoreAgainstRubric(rubric, [{ criterion: 'A', score: 5 }, { criterion: 'A', score: 5 }, { criterion: 'B', score: 1 }])).toThrow(/twice/);
    expect(() => scoreAgainstRubric(rubric, [{ criterion: 'A', score: 11 }, { criterion: 'B', score: 1 }])).toThrow(/between/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Access', () => {
  it('only mentors and admins can review', async () => {
    const student = await createStudent();
    await request(app).get('/api/review/submissions').expect(401);
    const res = await request(app).get('/api/review/submissions').set(student.auth).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');

    const mentor = await createStudent('mentor');
    const admin = await createStudent('admin');
    await request(app).get('/api/review/submissions').set(mentor.auth).expect(200);
    await request(app).get('/api/review/submissions').set(admin.auth).expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Review queue', () => {
  it('lists pending submissions oldest first with student and course, paginated', async () => {
    const mentor = await createStudent('mentor');
    const a = await submittedStudent();
    const b = await submittedStudent();
    const c = await submittedStudent();

    const page1 = await request(app).get('/api/review/submissions?limit=2').set(mentor.auth).expect(200);
    expect(page1.body.items.map((i: { id: string }) => i.id)).toEqual([a.submissionId, b.submissionId]);
    expect(page1.body.items[0]).toMatchObject({ student: { name: 'Ravi Kumar' }, course: { title: 'Full Stack Web Development' } });
    expect(page1.body.nextCursor).toBe(b.submissionId);

    const page2 = await request(app).get(`/api/review/submissions?limit=2&cursor=${page1.body.nextCursor}`).set(mentor.auth).expect(200);
    expect(page2.body.items.map((i: { id: string }) => i.id)).toEqual([c.submissionId]);
    expect(page2.body.nextCursor).toBeNull();

    await approve(mentor.auth, a.submissionId).expect(200);
    const after = await request(app).get('/api/review/submissions').set(mentor.auth).expect(200);
    expect(after.body.items).toHaveLength(2);
  });

  it('shows one submission with the rubric and earlier versions', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent();
    await decide(mentor.auth, s.submissionId, { decision: 'changes_requested', rubricScores: LOW, feedback: 'Please add search and deploy it.' }).expect(200);
    const v2 = await request(app)
      .post(`/api/enrollments/${s.enrollment._id}/project/submissions`)
      .set(s.student.auth)
      .send({ repoUrl: 'https://github.com/ravi/job-board' })
      .expect(201);

    const res = await request(app).get(`/api/review/submissions/${v2.body.submission.id}`).set(mentor.auth).expect(200);
    expect(res.body.submission.version).toBe(2);
    expect(res.body.project.rubric).toHaveLength(3);
    expect(res.body.previousVersions).toEqual([
      expect.objectContaining({ version: 1, status: 'changes_requested', feedback: 'Please add search and deploy it.' }),
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Decision', () => {
  it('"changes requested" reopens submission for the student, audits it and emails them', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent();

    const res = await decide(mentor.auth, s.submissionId, { decision: 'changes_requested', rubricScores: LOW, feedback: 'Please add search and deploy it.' }).expect(200);
    expect(res.body).toMatchObject({ decision: 'changes_requested', totalPercent: 30, completion: null });

    expect((await ProjectSubmission.findById(s.submissionId))?.status).toBe('changes_requested');
    expect((await Enrollment.findById(s.enrollment._id))?.projectStatus).toBe('changes_requested');
    expect(await AuditLog.countDocuments({ action: 'submission.review', targetId: s.submissionId })).toBe(1);

    const job = await getDocumentsQueue().getJob(`review-email-${s.submissionId}`);
    expect(job).toBeTruthy();
    expect(await processDocumentJob({ name: job!.name, data: job!.data })).toBe('sent');
    expect(mockedReviewEmail).toHaveBeenCalledWith(expect.any(String), 'Ravi Kumar', 'changes_requested', 'Full Stack Web Development', 30);
  });

  it('validates scores and feedback, and refuses to approve below the pass mark', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent();

    const missing = await decide(mentor.auth, s.submissionId, { decision: 'approved', rubricScores: FULL.slice(0, 2), feedback: 'Looks great overall.' }).expect(400);
    expect(missing.body.code).toBe('RUBRIC_INVALID');
    const tooHigh = await decide(mentor.auth, s.submissionId, { decision: 'approved', rubricScores: [{ criterion: 'Features', score: 11 }, ...FULL.slice(1)], feedback: 'Looks great overall.' }).expect(400);
    expect(tooHigh.body.code).toBe('RUBRIC_INVALID');
    const noFeedback = await decide(mentor.auth, s.submissionId, { decision: 'approved', rubricScores: FULL, feedback: 'ok' }).expect(400);
    expect(noFeedback.body.code).toBe('VALIDATION_ERROR');

    const low = await decide(mentor.auth, s.submissionId, { decision: 'approved', rubricScores: LOW, feedback: 'Approving anyway.' }).expect(400);
    expect(low.body.code).toBe('SCORE_BELOW_PASS');

    // Nothing was written by any rejected attempt
    expect((await ProjectSubmission.findById(s.submissionId))?.status).toBe('pending');
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it('a submission can be decided only once - even by two mentors at the same moment', async () => {
    const m1 = await createStudent('mentor');
    const m2 = await createStudent('mentor');
    const s = await submittedStudent();

    const results = await Promise.all([approve(m1.auth, s.submissionId), approve(m2.auth, s.submissionId)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe('SUBMISSION_ALREADY_REVIEWED');
    expect(await AuditLog.countDocuments()).toBe(1);

    await approve(m1.auth, s.submissionId).expect(409);
  });

  it('audit logs are append-only', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent();
    await approve(mentor.auth, s.submissionId).expect(200);
    await expect(AuditLog.updateOne({}, { action: 'tampered' })).rejects.toThrow(/append-only/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Completion and certificate timing (D2)', () => {
  it('batch already ended: approval completes the course and issues certificate + completion letter', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent({ batchEnded: true });

    const res = await approve(mentor.auth, s.submissionId).expect(200);
    expect(res.body.completion).toBe('completed');

    const enrollment = await Enrollment.findById(s.enrollment._id);
    expect(enrollment).toMatchObject({ status: 'completed', projectStatus: 'approved' });
    const types = (await Credential.find({ enrollmentId: s.enrollment._id })).map((c) => c.type).sort();
    expect(types).toEqual(['completion_certificate', 'completion_letter']);

    const dash = await request(app).get(`/api/enrollments/${s.enrollment._id}`).set(s.student.auth).expect(200);
    expect(dash.body.enrollment.completion).toMatchObject({ completed: true, documentsIssued: true });
  });

  it('batch still running: course completes now, documents are scheduled for the batch end date', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent({ batchEnded: false });

    await approve(mentor.auth, s.submissionId).expect(200);
    expect((await Enrollment.findById(s.enrollment._id))?.status).toBe('completed');
    expect(await Credential.countDocuments({ enrollmentId: s.enrollment._id })).toBe(0);

    const job = await getDocumentsQueue().getJob(`completion-${s.enrollment._id}`);
    expect(job?.name).toBe('issue-completion-documents');
    expect(job!.opts.delay).toBeGreaterThan(50 * 24 * 3600 * 1000); // ~55 days away

    const dash = await request(app).get(`/api/enrollments/${s.enrollment._id}`).set(s.student.auth).expect(200);
    expect(dash.body.enrollment.completion).toMatchObject({ completed: true, documentsIssued: false });
    expect(new Date(dash.body.enrollment.completion.documentsAvailableFrom).getTime()).toBe(s.cohort.endDate.getTime());

    // If the job ever fired early, it still refuses
    expect(await issueCompletionDocuments(s.enrollment._id)).toBe('batch_not_ended');

    // Batch ends → the delayed job runs
    await Cohort.updateOne({ _id: s.cohort._id }, { startDate: new Date(Date.now() - 60 * 864e5), endDate: new Date(Date.now() - 1000) });
    expect(await processDocumentJob({ name: job!.name, data: job!.data })).toBe('issued');
    expect(await Credential.countDocuments({ enrollmentId: s.enrollment._id })).toBe(2);
  });

  it('the hourly sweep issues documents that were missed, exactly once', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent({ batchEnded: false });
    await approve(mentor.auth, s.submissionId).expect(200);

    // Delayed job lost (e.g. Redis wiped) and the batch has ended
    await getDocumentsQueue().remove(`completion-${s.enrollment._id}`);
    await Cohort.updateOne({ _id: s.cohort._id }, { startDate: new Date(Date.now() - 60 * 864e5), endDate: new Date(Date.now() - 1000) });

    expect(await sweepCompletedEnrollments()).toBe(1);
    expect(await Credential.countDocuments({ enrollmentId: s.enrollment._id })).toBe(2);
    expect(await sweepCompletedEnrollments()).toBe(0);
  });

  it('a refunded or still-active enrollment never gets completion documents', async () => {
    const mentor = await createStudent('mentor');
    const s = await submittedStudent({ batchEnded: true });
    await Enrollment.updateOne({ _id: s.enrollment._id }, { status: 'refunded' });
    await approve(mentor.auth, s.submissionId).expect(200);
    expect(await Credential.countDocuments({ enrollmentId: s.enrollment._id })).toBe(0);
    expect(await issueCompletionDocuments(s.enrollment._id)).toBe('not_completed');
  });
});
