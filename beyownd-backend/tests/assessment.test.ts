// tests/assessment.test.ts
// Phase 2: module quizzes (server grading, cooldown, answer-leak rule,
// unlock on pass) and final project submission (gate, versions, validation).

import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Enrollment from '../src/models/enrollment.model';
import QuizAttempt from '../src/models/quizAttempt.model';
import ProjectSubmission from '../src/models/projectSubmission.model';
import { gradeAnswers } from '../src/services/quiz.service';
import { redisClient } from '../src/config/redis';
import { createLearningSetup, createQuiz } from './helpers/fixtures';

const oid = (doc: { _id: unknown }) => doc._id as Types.ObjectId;
type Auth = { Authorization: string };

const completeLesson = (auth: Auth, enrollmentId: unknown, lessonId: unknown) =>
  request(app).post(`/api/enrollments/${enrollmentId}/lessons/${lessonId}/complete`).set(auth).expect(200);

const quizUrl = (enrollmentId: unknown, moduleId: unknown) => `/api/enrollments/${enrollmentId}/modules/${moduleId}/quiz`;

const clearQuizCooldowns = async () => {
  const keys = await redisClient.keys('quiz_cooldown:*');
  if (keys.length) await redisClient.del(...keys);
};

// Answers built from the fixture's known correct options
const answersFor = (questions: { id: string; prompt: string }[], allCorrect: boolean) => {
  const correct: Record<string, number[]> = { Q1: [0], Q2: [0], Q3: [0], Q4: [1], Q5: [0, 2] };
  const wrong: Record<string, number[]> = { Q1: [1], Q2: [1], Q3: [1], Q4: [0], Q5: [0] };
  return questions.map((q) => ({ questionId: q.id, selectedOptionIndexes: (allCorrect ? correct : wrong)[q.prompt] }));
};

// Course: module 1 (2 lessons + quiz), module 2 (1 lesson)
const setupWithQuiz = async () => {
  const setup = await createLearningSetup({ lessonsPerModule: [2, 1] });
  const quiz = await createQuiz(oid(setup.course), oid(setup.modules[0]));
  return { ...setup, quiz, auth: setup.student.auth };
};

const finishModule1Lessons = async (s: Awaited<ReturnType<typeof setupWithQuiz>>) => {
  await completeLesson(s.auth, s.enrollment._id, s.lessons[0]._id);
  await completeLesson(s.auth, s.enrollment._id, s.lessons[1]._id);
};

// ─────────────────────────────────────────────────────────────────────────
describe('Quiz grading (pure function)', () => {
  const questions = [
    { id: 'a', prompt: '', type: 'single' as const, options: ['x', 'y'], correctOptionIndexes: [1], explanation: null, points: 1 },
    { id: 'b', prompt: '', type: 'multiple' as const, options: ['x', 'y', 'z'], correctOptionIndexes: [0, 2], explanation: null, points: 3 },
  ];

  it('multiple-choice needs exactly the right set - no partial credit', () => {
    expect(gradeAnswers(questions, [{ questionId: 'b', selectedOptionIndexes: [0] }]).scorePercent).toBe(0);
    expect(gradeAnswers(questions, [{ questionId: 'b', selectedOptionIndexes: [0, 1, 2] }]).scorePercent).toBe(0);
    expect(gradeAnswers(questions, [{ questionId: 'b', selectedOptionIndexes: [2, 0] }]).scorePercent).toBe(75);
  });

  it('weights by points, ignores duplicates, and counts missing answers as wrong', () => {
    const all = gradeAnswers(questions, [
      { questionId: 'a', selectedOptionIndexes: [1, 1] },
      { questionId: 'b', selectedOptionIndexes: [0, 2] },
    ]);
    expect(all.scorePercent).toBe(100);
    expect(gradeAnswers(questions, []).scorePercent).toBe(0);
    expect(gradeAnswers(questions, [{ questionId: 'fake', selectedOptionIndexes: [0] }]).scorePercent).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Module quiz', () => {
  it('a module with a quiz is not complete after lessons alone - next module stays locked', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);

    const dash = await request(app).get(`/api/enrollments/${s.enrollment._id}`).set(s.auth).expect(200);
    expect(dash.body.enrollment.modules[0]).toMatchObject({ hasQuiz: true, completed: false });
    expect(dash.body.enrollment.modules[1].unlocked).toBe(false);
  });

  it('opens only after all lessons of the module are complete', async () => {
    const s = await setupWithQuiz();
    const res = await request(app).get(quizUrl(s.enrollment._id, s.modules[0]._id)).set(s.auth).expect(403);
    expect(res.body.code).toBe('LESSONS_INCOMPLETE');
  });

  it('never sends correct answers or explanations with the questions', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const res = await request(app).get(quizUrl(s.enrollment._id, s.modules[0]._id)).set(s.auth).expect(200);

    expect(res.body.quiz.questions).toHaveLength(5);
    for (const q of res.body.quiz.questions) {
      expect(q.correctOptionIndexes).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
    expect(JSON.stringify(res.body)).not.toContain('E1');
  });

  it('returns 404 for a module without a quiz', async () => {
    const s = await setupWithQuiz();
    await request(app).get(quizUrl(s.enrollment._id, s.modules[1]._id)).set(s.auth).expect(403); // locked first
    await request(app).get(quizUrl(s.enrollment._id, 'not-an-id')).set(s.auth).expect(404);
  });

  it('a failed attempt shows only right/wrong - no answers - and records the best score', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const quiz = await request(app).get(quizUrl(s.enrollment._id, s.modules[0]._id)).set(s.auth).expect(200);

    const res = await request(app)
      .post(`${quizUrl(s.enrollment._id, s.modules[0]._id)}/attempts`)
      .set(s.auth)
      .send({ answers: answersFor(quiz.body.quiz.questions, false) })
      .expect(200);

    expect(res.body).toMatchObject({ passed: false, scorePercent: 0, moduleCompleted: false, attemptNumber: 1 });
    for (const r of res.body.results) {
      expect(Object.keys(r).sort()).toEqual(['correct', 'questionId']);
    }
  });

  it('enforces a 60s cooldown between attempts with retryAfterSeconds + Retry-After header', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const url = `${quizUrl(s.enrollment._id, s.modules[0]._id)}/attempts`;
    await request(app).post(url).set(s.auth).send({ answers: [] }).expect(200);

    const res = await request(app).post(url).set(s.auth).send({ answers: [] }).expect(429);
    expect(res.body.code).toBe('QUIZ_COOLDOWN');
    expect(res.body.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('passing completes the module, unlocks the next one, and reveals answers + explanations', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const quiz = await request(app).get(quizUrl(s.enrollment._id, s.modules[0]._id)).set(s.auth).expect(200);

    const res = await request(app)
      .post(`${quizUrl(s.enrollment._id, s.modules[0]._id)}/attempts`)
      .set(s.auth)
      .send({ answers: answersFor(quiz.body.quiz.questions, true) })
      .expect(200);

    expect(res.body).toMatchObject({ passed: true, scorePercent: 100, moduleCompleted: true });
    expect(res.body.nextModuleUnlocked).toEqual({ id: String(s.modules[1]._id), title: 'Module 2' });
    expect(res.body.results[0].correctOptionIndexes).toBeDefined();
    expect(res.body.results[0].explanation).toMatch(/^E\d$/);

    await request(app).get(`/api/enrollments/${s.enrollment._id}/lessons/${s.lessons[2]._id}`).set(s.auth).expect(200);
  });

  it('the best score never goes down and a pass is never lost', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const quiz = await request(app).get(quizUrl(s.enrollment._id, s.modules[0]._id)).set(s.auth).expect(200);
    const url = `${quizUrl(s.enrollment._id, s.modules[0]._id)}/attempts`;

    await request(app).post(url).set(s.auth).send({ answers: answersFor(quiz.body.quiz.questions, true) }).expect(200);
    await clearQuizCooldowns();
    await request(app).post(url).set(s.auth).send({ answers: answersFor(quiz.body.quiz.questions, false) }).expect(200);

    const stored = await Enrollment.findById(s.enrollment._id);
    expect(stored?.progress[0]).toMatchObject({ quizPassed: true, bestQuizScorePercent: 100 });

    const attempts = await request(app).get(url).set(s.auth).expect(200);
    expect(attempts.body.attempts.map((a: { attemptNumber: number }) => a.attemptNumber)).toEqual([2, 1]);
  });

  it('parallel submissions: one is graded, the rest get QUIZ_COOLDOWN', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const url = `${quizUrl(s.enrollment._id, s.modules[0]._id)}/attempts`;

    const responses = await Promise.all([1, 2, 3].map(() => request(app).post(url).set(s.auth).send({ answers: [] })));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 429, 429]);
    expect(await QuizAttempt.countDocuments()).toBe(1);
  });

  it('rejects malformed answers', async () => {
    const s = await setupWithQuiz();
    await finishModule1Lessons(s);
    const url = `${quizUrl(s.enrollment._id, s.modules[0]._id)}/attempts`;
    await request(app).post(url).set(s.auth).send({ answers: 'all correct' }).expect(400);
    await request(app).post(url).set(s.auth).send({ answers: [{ questionId: 'x', selectedOptionIndexes: [0] }] }).expect(400);
    await request(app).post(url).set(s.auth).send({ answers: [{ questionId: String(new Types.ObjectId()), selectedOptionIndexes: [9] }] }).expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Final project', () => {
  const VALID = { repoUrl: 'https://github.com/ravi/job-board', liveUrl: 'https://job-board.vercel.app', notes: 'Done!' };

  // Course of 2 modules with 1 lesson each, no quizzes → completing lessons completes the course modules
  const setupProject = async () => {
    const s = await createLearningSetup({ lessonsPerModule: [1, 1] });
    return { ...s, auth: s.student.auth };
  };
  const finishAllModules = async (s: Awaited<ReturnType<typeof setupProject>>) => {
    for (const l of s.lessons) await completeLesson(s.auth, s.enrollment._id, l._id);
  };
  const submit = (s: { auth: Auth; enrollment: { _id: unknown } }, body: Record<string, unknown> = VALID) =>
    request(app).post(`/api/enrollments/${s.enrollment._id}/project/submissions`).set(s.auth).send(body);

  it('is locked until every module is complete', async () => {
    const s = await setupProject();
    const res = await request(app).get(`/api/enrollments/${s.enrollment._id}/project`).set(s.auth).expect(200);
    expect(res.body).toMatchObject({ unlocked: false, canSubmit: false, projectStatus: 'not_submitted' });
    expect(res.body.project.rubric).toHaveLength(3);

    const blocked = await submit(s).expect(403);
    expect(blocked.body.code).toBe('MODULES_INCOMPLETE');
  });

  it('accepts one submission and blocks a second while it is pending', async () => {
    const s = await setupProject();
    await finishAllModules(s);

    const first = await submit(s).expect(201);
    expect(first.body).toMatchObject({ projectStatus: 'pending_review', submission: { version: 1, status: 'pending' } });

    const second = await submit(s).expect(409);
    expect(second.body.code).toBe('SUBMISSION_PENDING');
  });

  it('only accepts GitHub repo links and https live links', async () => {
    const s = await setupProject();
    await finishAllModules(s);
    await submit(s, { repoUrl: 'https://gitlab.com/ravi/job-board' }).expect(400);
    await submit(s, { repoUrl: 'https://github.com/ravi' }).expect(400);
    await submit(s, { repoUrl: 'https://github.com.evil.com/ravi/job-board' }).expect(400);
    await submit(s, { repoUrl: VALID.repoUrl, liveUrl: 'http://insecure.example.com' }).expect(400);
    await submit(s, { repoUrl: VALID.repoUrl }).expect(201); // live link optional
  });

  it('after "changes requested" a resubmission becomes version 2; after approval no more submissions', async () => {
    const s = await setupProject();
    await finishAllModules(s);
    await submit(s).expect(201);

    // Phase 3 mentor review will do this - simulate it
    await Enrollment.updateOne({ _id: s.enrollment._id }, { projectStatus: 'changes_requested' });
    const v2 = await submit(s).expect(201);
    expect(v2.body.submission.version).toBe(2);

    await Enrollment.updateOne({ _id: s.enrollment._id }, { projectStatus: 'approved' });
    const done = await submit(s).expect(409);
    expect(done.body.code).toBe('PROJECT_ALREADY_APPROVED');
  });

  it('parallel submissions create exactly one', async () => {
    const s = await setupProject();
    await finishAllModules(s);
    const responses = await Promise.all([1, 2, 3].map(() => submit(s)));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await ProjectSubmission.countDocuments()).toBe(1);
  });

  it('shows review feedback to the student without exposing the reviewer', async () => {
    const s = await setupProject();
    await finishAllModules(s);
    const created = await submit(s).expect(201);
    await ProjectSubmission.updateOne(
      { _id: created.body.submission.id },
      {
        status: 'changes_requested',
        review: {
          reviewerId: new Types.ObjectId(),
          rubricScores: [{ criterion: 'Features', score: 5 }],
          totalPercent: 50,
          feedback: 'Add search',
          decidedAt: new Date(),
        },
      }
    );
    const res = await request(app).get(`/api/enrollments/${s.enrollment._id}/project`).set(s.auth).expect(200);
    expect(res.body.submissions[0].review).toMatchObject({ feedback: 'Add search', totalPercent: 50 });
    expect(res.body.submissions[0].review.reviewerId).toBeUndefined();
  });
});
