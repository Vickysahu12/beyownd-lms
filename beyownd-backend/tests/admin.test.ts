// tests/admin.test.ts
// B6 admin APIs (content, batches, students, operations, stats) and
// B7 course import (validated against docs/content/example-course).

import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Course from '../src/models/course.model';
import Module from '../src/models/module.model';
import Lesson from '../src/models/lesson.model';
import Quiz from '../src/models/quiz.model';
import Cohort from '../src/models/cohort.model';
import Enrollment from '../src/models/enrollment.model';
import Payment from '../src/models/payment.model';
import Credential from '../src/models/credential.model';
import AuditLog from '../src/models/auditLog.model';
import { redisClient } from '../src/config/redis';
import { issueCredential } from '../src/services/credential.service';
import { importCourse, CourseDef } from '../src/services/admin/courseImport.service';
import { createCourse, createCohort, createStudent, createEnrollment } from './helpers/fixtures';

const oid = (doc: { _id: unknown }) => doc._id as Types.ObjectId;
const EXAMPLE_DIR = path.join(__dirname, '..', '..', 'docs', 'content', 'example-course');
const exampleDef = () => JSON.parse(fs.readFileSync(path.join(EXAMPLE_DIR, 'course.json'), 'utf8')) as CourseDef;

const NEW_COURSE = {
  title: 'Data Analytics Internship',
  slug: 'data-analytics',
  description: 'Learn analytics.',
  durationWeeks: 6,
  defaultPricePaise: 69900,
  project: {
    title: 'Sales dashboard',
    brief: 'Build a sales dashboard from a CSV.',
    rubric: [
      { criterion: 'Insights', maxScore: 10 },
      { criterion: 'Charts', maxScore: 10 },
      { criterion: 'Presentation', maxScore: 10 },
    ],
  },
};

let admin: Awaited<ReturnType<typeof createStudent>>;
beforeEach(async () => {
  admin = await createStudent('admin');
});

const api = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', url: string) => request(app)[method](url).set(admin.auth);

// ─────────────────────────────────────────────────────────────────────────
describe('Access', () => {
  it('only admins - students and mentors get 403', async () => {
    const student = await createStudent();
    const mentor = await createStudent('mentor');
    await request(app).get('/api/admin/courses').set(student.auth).expect(403);
    await request(app).get('/api/admin/courses').set(mentor.auth).expect(403);
    await request(app).get('/api/admin/courses').expect(401);
    await api('get', '/api/admin/courses').expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Content editor', () => {
  it('creates a draft course; duplicate slug and bad input are rejected', async () => {
    const res = await api('post', '/api/admin/courses').send(NEW_COURSE).expect(201);
    expect(res.body.course).toMatchObject({ slug: 'data-analytics', status: 'draft' });
    expect((await api('post', '/api/admin/courses').send(NEW_COURSE).expect(409)).body.code).toBe('SLUG_TAKEN');
    await api('post', '/api/admin/courses').send({ ...NEW_COURSE, slug: 'Bad Slug!' }).expect(400);
    await api('post', '/api/admin/courses').send({ ...NEW_COURSE, slug: 'x2', project: { ...NEW_COURSE.project, rubric: [] } }).expect(400);
  });

  it('builds modules + lessons, refuses to publish an incomplete course, then publishes and shows it publicly', async () => {
    const courseId = (await api('post', '/api/admin/courses').send(NEW_COURSE).expect(201)).body.course._id;

    expect((await api('patch', `/api/admin/courses/${courseId}`).send({ status: 'published' }).expect(400)).body.code).toBe('COURSE_INCOMPLETE');

    const m1 = (await api('post', `/api/admin/courses/${courseId}/modules`).send({ title: 'Basics', isFreePreview: true }).expect(201)).body.module;
    expect(m1.order).toBe(1);
    expect((await api('patch', `/api/admin/courses/${courseId}`).send({ status: 'published' }).expect(400)).body.message).toMatch(/no lessons/);

    const l1 = (await api('post', `/api/admin/modules/${m1._id}/lessons`).send({ title: 'Intro to data', content: 'v1' }).expect(201)).body.lesson;
    const l2 = (await api('post', `/api/admin/modules/${m1._id}/lessons`).send({ title: 'Spreadsheets', content: 'x' }).expect(201)).body.lesson;
    expect([l1.order, l2.order]).toEqual([1, 2]);

    // Public catalog is cached empty before publishing...
    expect((await request(app).get('/api/courses').expect(200)).body.courses).toHaveLength(0);
    await api('patch', `/api/admin/courses/${courseId}`).send({ status: 'published' }).expect(200);
    // ...and refreshed right after (cache invalidated)
    expect((await request(app).get('/api/courses').expect(200)).body.courses.map((c: { slug: string }) => c.slug)).toEqual(['data-analytics']);
    expect(await AuditLog.countDocuments({ action: 'course.publish' })).toBe(1);

    // Editing a lesson updates the public free preview immediately
    await request(app).get(`/api/courses/data-analytics/preview/lessons/${l1._id}`).expect(200);
    await api('patch', `/api/admin/lessons/${l1._id}`).send({ content: 'v2 - updated' }).expect(200);
    const preview = await request(app).get(`/api/courses/data-analytics/preview/lessons/${l1._id}`).expect(200);
    expect(preview.body.lesson.content).toBe('v2 - updated');

    const structure = (await api('get', `/api/admin/courses/${courseId}`).expect(200)).body;
    expect(structure.modules[0].lessons.map((l: { title: string }) => l.title)).toEqual(['Intro to data', 'Spreadsheets']);
  });

  it('video lessons need a YouTube ID', async () => {
    const { modules } = await createCourse({ lessonsPerModule: [1] });
    await api('post', `/api/admin/modules/${modules[0]._id}/lessons`).send({ title: 'A video', type: 'video' }).expect(400);
    await api('post', `/api/admin/modules/${modules[0]._id}/lessons`).send({ title: 'A video', type: 'video', videoYoutubeId: 'OEV8gMkCHXQ' }).expect(201);
  });

  it('reorders modules and lessons without breaking the unique order', async () => {
    const { course, modules, lessons } = await createCourse({ lessonsPerModule: [2, 1, 1] });
    const ids = modules.map((m) => String(m._id));
    await api('put', `/api/admin/courses/${course._id}/modules/order`).send({ moduleIds: [ids[2], ids[0], ids[1]] }).expect(200);
    const ordered = await Module.find({ courseId: course._id }).sort({ order: 1 });
    expect(ordered.map((m) => String(m._id))).toEqual([ids[2], ids[0], ids[1]]);

    const bad = await api('put', `/api/admin/courses/${course._id}/modules/order`).send({ moduleIds: [ids[0], ids[1]] }).expect(400);
    expect(bad.body.code).toBe('REORDER_INVALID');

    await api('put', `/api/admin/modules/${modules[0]._id}/lessons/order`).send({ lessonIds: [String(lessons[1]._id), String(lessons[0]._id)] }).expect(200);
    expect((await Lesson.findById(lessons[1]._id))?.order).toBe(1);
  });

  it('saves a quiz only when every answer index is valid, and the outline then shows hasQuiz', async () => {
    const { course, modules } = await createCourse({ slug: 'quiz-course', lessonsPerModule: [1] });
    const questions = [
      { prompt: 'Q1', options: ['a', 'b'], correctOptionIndexes: [1] },
      { prompt: 'Q2', options: ['a', 'b'], correctOptionIndexes: [0] },
      { prompt: 'Q3', type: 'multiple', options: ['a', 'b', 'c'], correctOptionIndexes: [0, 2] },
    ];
    const outOfRange = [...questions.slice(0, 2), { prompt: 'Q3', options: ['a', 'b'], correctOptionIndexes: [3] }];
    await api('put', `/api/admin/modules/${modules[0]._id}/quiz`).send({ questions: outOfRange }).expect(400);
    await api('put', `/api/admin/modules/${modules[0]._id}/quiz`).send({ questions }).expect(200);

    const outline = await request(app).get('/api/courses/quiz-course').expect(200);
    expect(outline.body.course.outline.modules[0].hasQuiz).toBe(true);
    expect(await Quiz.countDocuments({ courseId: course._id })).toBe(1);
  });

  it('modules can be deleted only while no students are enrolled', async () => {
    const { course, modules } = await createCourse({ lessonsPerModule: [1, 1] });
    const cohort = await createCohort(oid(course));
    const student = await createStudent();
    const enrollment = await createEnrollment(oid(student.user), oid(course), oid(cohort), 'active');

    expect((await api('delete', `/api/admin/modules/${modules[1]._id}`).expect(409)).body.code).toBe('COURSE_HAS_STUDENTS');
    await Enrollment.deleteOne({ _id: enrollment._id });
    await api('delete', `/api/admin/modules/${modules[1]._id}`).expect(200);
    expect(await Lesson.countDocuments({ moduleId: modules[1]._id })).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'module.delete' })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Batches', () => {
  const BATCH = (courseId: unknown) => ({
    courseId: String(courseId),
    name: 'November 2026',
    code: 'fswd-nov26',
    startDate: '2026-11-10',
    endDate: '2027-01-05',
    enrollOpensAt: '2026-10-20',
    enrollClosesAt: '2026-11-12',
    capacity: 100,
    pricePaise: 59900,
    status: 'open',
  });

  it('creates a batch (code uppercased), rejects duplicates, and audits price changes', async () => {
    const { course } = await createCourse();
    const created = (await api('post', '/api/admin/cohorts').send(BATCH(course._id)).expect(201)).body.cohort;
    expect(created.code).toBe('FSWD-NOV26');
    expect((await api('post', '/api/admin/cohorts').send(BATCH(course._id)).expect(409)).body.code).toBe('CODE_TAKEN');

    await api('patch', `/api/admin/cohorts/${created._id}`).send({ pricePaise: 49900 }).expect(200);
    const audit = await AuditLog.findOne({ action: 'cohort.update_price' });
    expect(audit?.details).toMatchObject({ before: { pricePaise: 59900 }, after: { pricePaise: 49900 } });
  });

  it("capacity can't drop below seats already taken", async () => {
    const { course } = await createCourse();
    const cohort = await createCohort(oid(course), { capacity: 50, seatsTaken: 30 });
    const res = await api('patch', `/api/admin/cohorts/${cohort._id}`).send({ capacity: 20 }).expect(400);
    expect(res.body.code).toBe('CAPACITY_BELOW_SEATS');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Students and operations', () => {
  const paidEnrollment = async () => {
    const { course } = await createCourse();
    const cohort = await createCohort(oid(course), { seatsTaken: 1 });
    const student = await createStudent('student', { onboarded: true });
    const enrollment = await createEnrollment(oid(student.user), oid(course), oid(cohort), 'active');
    await Payment.create({
      userId: student.user._id, enrollmentId: enrollment._id, cohortId: cohort._id,
      amountPaise: 59900, razorpayOrderId: `order_${new Types.ObjectId()}`, razorpayPaymentId: `pay_${new Types.ObjectId()}`,
      status: 'paid', paidAt: new Date(),
    });
    return { course, cohort, student, enrollment };
  };

  it('searches students and shows one student in full', async () => {
    const { student, cohort } = await paidEnrollment();
    const found = await api('get', `/api/admin/students?q=${student.user.email.slice(0, 12)}`).expect(200);
    expect(found.body.items.map((s: { id: string }) => s.id)).toContain(String(student.user._id));
    const byBatch = await api('get', `/api/admin/students?cohortId=${cohort._id}&status=active`).expect(200);
    expect(byBatch.body.items).toHaveLength(1);
    await api('get', '/api/admin/students?q=.*').expect(200); // regex characters are plain text

    const detail = await api('get', `/api/admin/students/${student.user._id}`).expect(200);
    expect(detail.body.user.email).toBe(student.user.email);
    expect(detail.body.enrollments).toHaveLength(1);
    expect(detail.body.payments[0]).toMatchObject({ status: 'paid', amountPaise: 59900 });
  });

  it('refund marks the enrollment refunded, frees the seat, revokes documents and is audited', async () => {
    const { enrollment, cohort } = await paidEnrollment();
    await issueCredential(String(enrollment._id), 'offer_letter');

    await api('post', `/api/admin/enrollments/${enrollment._id}/refund`).send({ reason: 'Student requested within 7 days' }).expect(200);
    expect((await Enrollment.findById(enrollment._id))?.status).toBe('refunded');
    expect((await Cohort.findById(cohort._id))?.seatsTaken).toBe(0);
    expect((await Credential.findOne({ enrollmentId: enrollment._id }))?.status).toBe('revoked');
    expect(await AuditLog.countDocuments({ action: 'enrollment.refund' })).toBe(1);

    expect((await api('post', `/api/admin/enrollments/${enrollment._id}/refund`).send({ reason: 'again please' }).expect(409)).body.code).toBe('NO_PAID_PAYMENT');
    await api('post', `/api/admin/enrollments/${enrollment._id}/refund`).send({ reason: 'x' }).expect(400); // reason too short
  });

  it('revokes a credential (verify shows it immediately) and reissues missing documents', async () => {
    const { enrollment } = await paidEnrollment();
    const reissued = await api('post', `/api/admin/enrollments/${enrollment._id}/credentials/reissue`).expect(200);
    expect(reissued.body.completion).toBe('not_completed');
    const offer = await Credential.findOne({ enrollmentId: enrollment._id, type: 'offer_letter' });
    expect(offer).toBeTruthy();

    await request(app).get(`/api/verify/${offer!.credentialId}`).expect(200); // warm cache
    await api('post', `/api/admin/credentials/${offer!.credentialId}/revoke`).send({ reason: 'Fraudulent submission' }).expect(200);
    const verify = await request(app).get(`/api/verify/${offer!.credentialId}`).expect(200);
    expect(verify.body.credential.status).toBe('revoked');
    expect((await api('post', `/api/admin/credentials/${offer!.credentialId}/revoke`).send({ reason: 'again again' }).expect(409)).body.code).toBe('ALREADY_REVOKED');
  });

  it('makes someone a mentor (their sessions end) but never changes your own role', async () => {
    const user = await createStudent();
    await redisClient.sadd(`user_sessions:${user.user._id}`, 'sid-1');
    await redisClient.set('session:sid-1', '{}');

    const res = await api('patch', `/api/admin/users/${user.user._id}/role`).send({ role: 'mentor' }).expect(200);
    expect(res.body.user.role).toBe('mentor');
    expect(await redisClient.exists('session:sid-1')).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'user.set_role' })).toBe(1);

    const self = await api('patch', `/api/admin/users/${admin.user._id}/role`).send({ role: 'student' }).expect(400);
    expect(self.body.code).toBe('CANNOT_CHANGE_OWN_ROLE');
    await api('patch', `/api/admin/users/${user.user._id}/role`).send({ role: 'superuser' }).expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Stats', () => {
  it('overview, funnel and colleges reflect the data', async () => {
    const { course, modules, lessons } = await createCourse({ lessonsPerModule: [1, 1] });
    const cohort = await createCohort(oid(course));
    const student = await createStudent('student', { onboarded: true });
    const enrollment = await createEnrollment(oid(student.user), oid(course), oid(cohort), 'active');
    await request(app).post(`/api/enrollments/${enrollment._id}/lessons/${lessons[0]._id}/complete`).set(student.auth).expect(200);
    await Payment.create({ userId: student.user._id, enrollmentId: enrollment._id, cohortId: cohort._id, amountPaise: 59900, razorpayOrderId: 'order_s1', razorpayPaymentId: 'pay_s1', status: 'paid' });

    const overview = (await api('get', '/api/admin/stats/overview').expect(200)).body.stats;
    expect(overview.students.total).toBe(1);
    expect(overview.revenue).toMatchObject({ paidCount: 1, paidPaise: 59900 });
    expect(overview.enrollments.active).toBe(1);

    const funnel = (await api('get', `/api/admin/stats/funnel?courseId=${course._id}`).expect(200)).body.funnel;
    expect(funnel.enrolled).toBe(1);
    expect(funnel.modules[0]).toMatchObject({ id: String(modules[0]._id), started: 1, completed: 1 });
    expect(funnel.modules[1]).toMatchObject({ started: 0, completed: 0 });

    const colleges = (await api('get', '/api/admin/stats/colleges').expect(200)).body.colleges;
    expect(colleges[0]).toMatchObject({ college: 'Govt College of Engineering, Pune', students: 1, paidStudents: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Course import (B7) - using docs/content/example-course', () => {
  it('the example course is valid; a dry run writes nothing', async () => {
    const result = await importCourse(exampleDef(), EXAMPLE_DIR, { dryRun: true });
    expect(result).toMatchObject({ created: true, modules: 2, lessons: 5, quizzes: 2, dryRun: true });
    expect(await Course.countDocuments()).toBe(0);
  });

  it('imports as a draft, is idempotent, and --publish makes it live', async () => {
    const first = await importCourse(exampleDef(), EXAMPLE_DIR);
    expect(first).toMatchObject({ created: true, status: 'draft' });
    const again = await importCourse(exampleDef(), EXAMPLE_DIR);
    expect(again.created).toBe(false);
    expect(await Module.countDocuments()).toBe(2);
    expect(await Lesson.countDocuments()).toBe(5);
    expect(await Quiz.countDocuments()).toBe(2);
    const lesson = await Lesson.findOne({ title: 'HTML basics' });
    expect(lesson?.content).toContain('<h1>Hello Beyownd</h1>');

    await importCourse(exampleDef(), EXAMPLE_DIR, { publish: true });
    const res = await request(app).get('/api/courses/example-web-foundations').expect(200);
    expect(res.body.course.outline.totalLessons).toBe(5);
  });

  it('removes content dropped from the file - but refuses while students are enrolled', async () => {
    await importCourse(exampleDef(), EXAMPLE_DIR);
    const shorter = exampleDef();
    shorter.modules[0].lessons = shorter.modules[0].lessons.slice(0, 2);

    const course = await Course.findOne({ slug: 'example-web-foundations' });
    const cohort = await createCohort(oid(course!));
    const student = await createStudent();
    await createEnrollment(oid(student.user), oid(course!), oid(cohort), 'active');
    await expect(importCourse(shorter, EXAMPLE_DIR)).rejects.toThrow(/students are enrolled/);

    await Enrollment.deleteMany({});
    const result = await importCourse(shorter, EXAMPLE_DIR);
    expect(result.removedLessons).toBe(1);
    expect(await Lesson.countDocuments()).toBe(4);
  });

  it('points to the exact problem in a bad file, and blocks paths outside the folder', async () => {
    const badQuiz = exampleDef();
    badQuiz.modules[1].quiz!.questions[0].correctOptionIndexes = [7];
    await expect(importCourse(badQuiz, EXAMPLE_DIR)).rejects.toThrow(/module 2 \("JavaScript Essentials"\), quiz/);

    const missing = exampleDef();
    missing.modules[0].lessons[0].contentFile = 'lessons/nope.md';
    await expect(importCourse(missing, EXAMPLE_DIR)).rejects.toThrow(/lesson 1 .*not found/);

    const escape = exampleDef();
    escape.modules[0].lessons[0].contentFile = '../../../../package.json';
    await expect(importCourse(escape, EXAMPLE_DIR)).rejects.toThrow(/outside the course folder/);

    // Nothing partially written
    expect(await Course.countDocuments()).toBe(0);
  });

  it('works from any folder (temp copy with its own markdown)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'byd-import-'));
    try {
      fs.writeFileSync(path.join(dir, 'brief.md'), '# Brief\nBuild it.');
      fs.writeFileSync(path.join(dir, 'l1.md'), '# Lesson one');
      const def: CourseDef = {
        ...exampleDef(),
        slug: 'tiny-course',
        project: { ...exampleDef().project, briefFile: 'brief.md' },
        modules: [{ title: 'Only module', lessons: [{ title: 'Lesson one', contentFile: 'l1.md' }] }],
      };
      const r = await importCourse(def, dir);
      expect(r).toMatchObject({ modules: 1, lessons: 1, quizzes: 0 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
