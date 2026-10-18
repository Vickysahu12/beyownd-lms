// tests/seed.test.ts - the dev seed must be safe to run any number of times
import request from 'supertest';
import app from '../src/app';
import Course from '../src/models/course.model';
import Module from '../src/models/module.model';
import Lesson from '../src/models/lesson.model';
import Cohort from '../src/models/cohort.model';
import Enrollment from '../src/models/enrollment.model';
import Quiz from '../src/models/quiz.model';
import { seedDevCourse } from '../scripts/seed/dev-course';
import { createStudent } from './helpers/fixtures';

describe('Dev seed script', () => {
  it('is idempotent and produces a browsable, enrollable course', async () => {
    const student = await createStudent();
    await seedDevCourse(student.user.email);
    await seedDevCourse(student.user.email);

    expect(await Course.countDocuments()).toBe(1);
    expect(await Module.countDocuments()).toBe(3);
    expect(await Lesson.countDocuments()).toBe(7);
    expect(await Cohort.countDocuments()).toBe(1);
    expect(await Quiz.countDocuments()).toBe(2);
    expect(await Enrollment.countDocuments({ status: 'active' })).toBe(1);

    const res = await request(app).get('/api/courses/full-stack-web-dev').expect(200);
    expect(res.body.course.outline.totalLessons).toBe(7);
    expect(res.body.course.outline.modules.map((m: { hasQuiz: boolean }) => m.hasQuiz)).toEqual([true, true, false]);

    const mine = await request(app).get('/api/enrollments').set(student.auth).expect(200);
    expect(mine.body.enrollments).toHaveLength(1);
  });

  it('refuses to enroll an unknown email', async () => {
    await expect(seedDevCourse('nobody@example.com')).rejects.toThrow(/sign up first/);
  });
});
