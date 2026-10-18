// tests/learning.test.ts
// Phase 1: public catalog (with Redis cache) and the enrolled-student
// learning flow (ownership, access rules, sequential unlock, lesson completion).

import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Course from '../src/models/course.model';
import Enrollment from '../src/models/enrollment.model';
import { invalidateCourseCache } from '../src/services/catalog.service';
import { redisClient } from '../src/config/redis';
import {
  createCourse,
  createCohort,
  createStudent,
  createEnrollment,
  createLearningSetup,
} from './helpers/fixtures';

const oid = (doc: { _id: unknown }) => doc._id as Types.ObjectId;

// ─────────────────────────────────────────────────────────────────────────
describe('Public catalog', () => {
  it('lists only published courses with price and next batch date', async () => {
    const { course } = await createCourse({ slug: 'web-dev', defaultPricePaise: 79900 });
    await createCohort(oid(course), { pricePaise: 59900, startsInDays: 14 });
    await createCohort(oid(course), { pricePaise: 69900, startsInDays: 40 });
    await createCourse({ slug: 'draft-course', status: 'draft' });

    const res = await request(app).get('/api/courses').expect(200);
    expect(res.body.courses).toHaveLength(1);
    const card = res.body.courses[0];
    expect(card.slug).toBe('web-dev');
    expect(card.fromPricePaise).toBe(59900); // cheapest open batch, not the default
    expect(new Date(card.nextCohortStartDate).getTime()).toBeGreaterThan(Date.now());
  });

  it('falls back to the course default price when no batch is open', async () => {
    await createCourse({ slug: 'no-batch', defaultPricePaise: 79900 });
    const res = await request(app).get('/api/courses').expect(200);
    expect(res.body.courses[0].fromPricePaise).toBe(79900);
    expect(res.body.courses[0].nextCohortStartDate).toBeNull();
  });

  it('returns course detail with an ordered outline and no lesson content', async () => {
    await createCourse({ slug: 'web-dev', lessonsPerModule: [2, 1] });
    const res = await request(app).get('/api/courses/web-dev').expect(200);
    const { outline } = res.body.course;

    expect(outline.modules.map((m: { order: number }) => m.order)).toEqual([1, 2]);
    expect(outline.modules[0].lessons).toHaveLength(2);
    expect(outline.totalLessons).toBe(3);
    expect(outline.modules[0].lessons[0].content).toBeUndefined();
    expect(res.body.course.project).toEqual({ title: 'Job board' }); // no rubric/brief leak
  });

  it('returns 404 for drafts and malformed slugs', async () => {
    await createCourse({ slug: 'secret', status: 'draft' });
    await request(app).get('/api/courses/secret').expect(404);
    await request(app).get('/api/courses/NOT_A_SLUG!').expect(404);
  });

  it('lists only open, not-yet-closed batches with seats left', async () => {
    const { course } = await createCourse({ slug: 'web-dev' });
    await createCohort(oid(course), { capacity: 50, seatsTaken: 20 });
    await createCohort(oid(course), { capacity: 10, seatsTaken: 10 }); // full
    await createCohort(oid(course), { status: 'scheduled' }); // not open
    await createCohort(oid(course), { enrollClosesInDays: -1 }); // closed

    const res = await request(app).get('/api/courses/web-dev/cohorts').expect(200);
    expect(res.body.cohorts).toHaveLength(2);
    const [open, full] = res.body.cohorts.sort((a: { seatsLeft: number }, b: { seatsLeft: number }) => b.seatsLeft - a.seatsLeft);
    expect(open).toMatchObject({ seatsLeft: 30, enrollable: true });
    expect(full).toMatchObject({ seatsLeft: 0, enrollable: false });
  });

  it('serves free-preview lessons without login, and only those', async () => {
    const { lessons } = await createCourse({ slug: 'web-dev', lessonsPerModule: [1, 1], freePreviewModules: [1] });
    const other = await createCourse({ slug: 'other' });

    const ok = await request(app).get(`/api/courses/web-dev/preview/lessons/${lessons[0]._id}`).expect(200);
    expect(ok.body.lesson.content).toBe('Content of lesson 1.1');

    const locked = await request(app).get(`/api/courses/web-dev/preview/lessons/${lessons[1]._id}`).expect(403);
    expect(locked.body.code).toBe('PREVIEW_NOT_AVAILABLE');

    // A lesson ID from a different course can't be read through this course
    await request(app).get(`/api/courses/web-dev/preview/lessons/${other.lessons[0]._id}`).expect(404);
    await request(app).get('/api/courses/web-dev/preview/lessons/not-an-id').expect(404);
  });

  it('serves from Redis after the first request, and refreshes after invalidation', async () => {
    const { course } = await createCourse({ slug: 'web-dev' });
    await request(app).get('/api/courses/web-dev').expect(200);
    expect(await redisClient.exists('cache:course:slug:web-dev')).toBe(1);

    // Change the DB directly - cached response must not change yet
    await Course.updateOne({ _id: course._id }, { title: 'Renamed Course' });
    const cached = await request(app).get('/api/courses/web-dev').expect(200);
    expect(cached.body.course.title).toBe('Full Stack Web Development');

    // What the admin panel will call after an edit
    await invalidateCourseCache({ id: String(course._id), slug: 'web-dev' });
    const fresh = await request(app).get('/api/courses/web-dev').expect(200);
    expect(fresh.body.course.title).toBe('Renamed Course');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Enrollments - ownership and dashboard', () => {
  it('requires login', async () => {
    await request(app).get('/api/enrollments').expect(401);
  });

  it('lists my enrollments with course, batch and progress', async () => {
    const { student, course } = await createLearningSetup();
    const res = await request(app).get('/api/enrollments').set(student.auth).expect(200);
    expect(res.body.enrollments).toHaveLength(1);
    expect(res.body.enrollments[0]).toMatchObject({
      status: 'active',
      percentComplete: 0,
      course: { slug: course.slug },
    });
  });

  it("returns 404 (not 403) for someone else's enrollment or a bad ID", async () => {
    const { enrollment } = await createLearningSetup();
    const stranger = await createStudent();
    await request(app).get(`/api/enrollments/${enrollment._id}`).set(stranger.auth).expect(404);
    await request(app).get('/api/enrollments/not-an-id').set(stranger.auth).expect(404);
  });

  it('shows module 1 unlocked and later modules locked at the start', async () => {
    const { student, enrollment } = await createLearningSetup({ lessonsPerModule: [2, 2, 1] });
    const res = await request(app).get(`/api/enrollments/${enrollment._id}`).set(student.auth).expect(200);
    const modules = res.body.enrollment.modules;
    expect(modules.map((m: { unlocked: boolean }) => m.unlocked)).toEqual([true, false, false]);
    expect(res.body.enrollment.cohort.communityLink).toBe('https://chat.whatsapp.com/test');
  });

  it('hides the community link from unpaid enrollments', async () => {
    const { course } = await createCourse();
    const cohort = await createCohort(oid(course));
    const student = await createStudent();
    const pending = await createEnrollment(oid(student.user), oid(course), oid(cohort), 'pending_payment');

    const res = await request(app).get(`/api/enrollments/${pending._id}`).set(student.auth).expect(200);
    expect(res.body.enrollment.cohort.communityLink).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Lessons - access rules and sequential unlock', () => {
  const lessonUrl = (enrollmentId: unknown, lessonId: unknown) => `/api/enrollments/${enrollmentId}/lessons/${lessonId}`;
  const completeUrl = (enrollmentId: unknown, lessonId: unknown) => `${lessonUrl(enrollmentId, lessonId)}/complete`;

  it('opens a lesson in module 1 with prev/next navigation', async () => {
    const { student, enrollment, lessons } = await createLearningSetup({ lessonsPerModule: [2, 1] });
    const res = await request(app).get(lessonUrl(enrollment._id, lessons[0]._id)).set(student.auth).expect(200);
    expect(res.body.lesson.content).toBe('Content of lesson 1.1');
    expect(res.body.lesson.previousLessonId).toBeNull();
    expect(res.body.lesson.nextLessonId).toBe(String(lessons[1]._id));
    expect(res.body.lesson.completed).toBe(false);
  });

  it('blocks lessons of a locked module with MODULE_LOCKED', async () => {
    const { student, enrollment, lessons } = await createLearningSetup({ lessonsPerModule: [2, 1] });
    const res = await request(app).get(lessonUrl(enrollment._id, lessons[2]._id)).set(student.auth).expect(403);
    expect(res.body.code).toBe('MODULE_LOCKED');
    // Completing a locked lesson is blocked too (not just reading it)
    await request(app).post(completeUrl(enrollment._id, lessons[2]._id)).set(student.auth).expect(403);
  });

  it('completing every lesson of module 1 completes it and unlocks module 2', async () => {
    const { student, enrollment, lessons, modules } = await createLearningSetup({ lessonsPerModule: [2, 1] });

    const first = await request(app).post(completeUrl(enrollment._id, lessons[0]._id)).set(student.auth).expect(200);
    expect(first.body).toMatchObject({ moduleCompleted: false, nextModuleUnlocked: null, percentComplete: 33 });

    const second = await request(app).post(completeUrl(enrollment._id, lessons[1]._id)).set(student.auth).expect(200);
    expect(second.body.moduleCompleted).toBe(true);
    expect(second.body.nextModuleUnlocked).toEqual({ id: String(modules[1]._id), title: 'Module 2' });

    await request(app).get(lessonUrl(enrollment._id, lessons[2]._id)).set(student.auth).expect(200);

    const stored = await Enrollment.findById(enrollment._id);
    expect(stored?.progress[0].completedAt).toBeInstanceOf(Date);
  });

  it('marking the same lesson twice is harmless', async () => {
    const { student, enrollment, lessons } = await createLearningSetup({ lessonsPerModule: [2] });
    await request(app).post(completeUrl(enrollment._id, lessons[0]._id)).set(student.auth).expect(200);
    const again = await request(app).post(completeUrl(enrollment._id, lessons[0]._id)).set(student.auth).expect(200);
    expect(again.body.percentComplete).toBe(50);

    const stored = await Enrollment.findById(enrollment._id);
    expect(stored?.progress).toHaveLength(1);
    expect(stored?.progress[0].completedLessonIds).toHaveLength(1);
  });

  it('parallel completions never create duplicate progress entries', async () => {
    const { student, enrollment, lessons } = await createLearningSetup({ lessonsPerModule: [3] });
    await Promise.all(
      lessons.map((l) => request(app).post(completeUrl(enrollment._id, l._id)).set(student.auth).expect(200))
    );
    const stored = await Enrollment.findById(enrollment._id);
    expect(stored?.progress).toHaveLength(1);
    expect(stored?.progress[0].completedLessonIds).toHaveLength(3);
  });

  it('blocks unpaid enrollments with ENROLLMENT_NOT_ACTIVE', async () => {
    const { course, lessons } = await createCourse({ freePreviewModules: [] });
    const cohort = await createCohort(oid(course));
    const student = await createStudent();
    const pending = await createEnrollment(oid(student.user), oid(course), oid(cohort), 'pending_payment');

    const res = await request(app).get(lessonUrl(pending._id, lessons[0]._id)).set(student.auth).expect(403);
    expect(res.body.code).toBe('ENROLLMENT_NOT_ACTIVE');
  });

  it('keeps paid content closed until the batch starts, but free preview stays open (D10)', async () => {
    const { student, enrollment, lessons } = await createLearningSetup(
      { lessonsPerModule: [1, 1], freePreviewModules: [1] },
      { startsInDays: 5 }
    );
    // Module 1 is free preview → open even before start
    await request(app).post(completeUrl(enrollment._id, lessons[0]._id)).set(student.auth).expect(200);
    // Module 2 is unlocked by progress, but the batch hasn't started
    const res = await request(app).get(lessonUrl(enrollment._id, lessons[1]._id)).set(student.auth).expect(403);
    expect(res.body.code).toBe('COHORT_NOT_STARTED');
  });

  it("can't read another course's lesson through my enrollment", async () => {
    const { student, enrollment } = await createLearningSetup();
    const other = await createCourse();
    await request(app).get(lessonUrl(enrollment._id, other.lessons[0]._id)).set(student.auth).expect(404);
  });
});
