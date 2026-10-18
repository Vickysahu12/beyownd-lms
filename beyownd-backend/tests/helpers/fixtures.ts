// tests/helpers/fixtures.ts
// Builders for test data, written straight to the in-memory DB. Faster than
// going through signup/OTP when a test only needs "a logged-in student with
// an enrollment".

import { Types } from 'mongoose';
import User from '../../src/models/user.model';
import Course from '../../src/models/course.model';
import Module from '../../src/models/module.model';
import Lesson from '../../src/models/lesson.model';
import Cohort from '../../src/models/cohort.model';
import Enrollment, { EnrollmentStatus } from '../../src/models/enrollment.model';
import Quiz from '../../src/models/quiz.model';
import { generateAccessToken } from '../../src/utils/generateTokens';

const DAY = 24 * 60 * 60 * 1000;
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export const createStudent = async (role: 'student' | 'mentor' | 'admin' = 'student', { onboarded = false } = {}) => {
  const user = await User.create({
    onboardingCompleted: onboarded,
    name: 'Test Student',
    email: `student-${unique()}@example.com`,
    password: 'Str0ng@Pass',
    authProviders: ['local'],
    isVerified: true,
    role,
  });
  const token = generateAccessToken({ userId: String(user._id), role: user.role });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
};

interface CourseOptions {
  status?: 'draft' | 'published' | 'archived';
  slug?: string;
  // lessons per module, e.g. [2, 2, 1] = 3 modules
  lessonsPerModule?: number[];
  freePreviewModules?: number[]; // module orders (1-based)
  defaultPricePaise?: number;
}

export const createCourse = async (options: CourseOptions = {}) => {
  const {
    status = 'published',
    slug = `course-${unique()}`,
    lessonsPerModule = [2, 2, 1],
    freePreviewModules = [1],
    defaultPricePaise = 79900,
  } = options;

  const course = await Course.create({
    title: 'Full Stack Web Development',
    slug,
    tagline: 'Build and ship real apps',
    description: 'Learn by building.',
    skills: ['React', 'Node.js'],
    durationWeeks: 8,
    defaultPricePaise,
    status,
    createdBy: new Types.ObjectId(),
    project: {
      title: 'Job board',
      brief: 'Build a job board.',
      rubric: [
        { criterion: 'Features', maxScore: 10 },
        { criterion: 'Code quality', maxScore: 10 },
        { criterion: 'Deployment', maxScore: 10 },
      ],
    },
  });

  const modules = [];
  const lessons = [];
  for (const [i, count] of lessonsPerModule.entries()) {
    const module = await Module.create({
      courseId: course._id,
      title: `Module ${i + 1}`,
      order: i + 1,
      isFreePreview: freePreviewModules.includes(i + 1),
    });
    modules.push(module);
    for (let j = 0; j < count; j++) {
      lessons.push(
        await Lesson.create({
          courseId: course._id,
          moduleId: module._id,
          title: `Lesson ${i + 1}.${j + 1}`,
          order: j + 1,
          content: `Content of lesson ${i + 1}.${j + 1}`,
          estimatedMinutes: 10,
        })
      );
    }
  }
  return { course, modules, lessons };
};

interface CohortOptions {
  startsInDays?: number; // negative = already started
  status?: 'scheduled' | 'open' | 'running' | 'completed' | 'cancelled';
  pricePaise?: number;
  capacity?: number;
  seatsTaken?: number;
  enrollClosesInDays?: number;
}

export const createCohort = async (courseId: Types.ObjectId, options: CohortOptions = {}) => {
  const {
    startsInDays = -1,
    status = 'open',
    pricePaise = 59900,
    capacity = 100,
    seatsTaken = 0,
    enrollClosesInDays = 10,
  } = options;
  const now = Date.now();
  return Cohort.create({
    courseId,
    name: 'Test batch',
    code: `T-${unique().toUpperCase()}`.slice(0, 20),
    startDate: new Date(now + startsInDays * DAY),
    endDate: new Date(now + (startsInDays + 56) * DAY),
    enrollOpensAt: new Date(now - 30 * DAY),
    enrollClosesAt: new Date(now + enrollClosesInDays * DAY),
    capacity,
    seatsTaken,
    pricePaise,
    status,
    communityLink: 'https://chat.whatsapp.com/test',
  });
};

export const createEnrollment = async (
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
  cohortId: Types.ObjectId,
  status: EnrollmentStatus = 'active'
) =>
  Enrollment.create({
    userId,
    courseId,
    cohortId,
    status,
    activatedAt: status === 'active' ? new Date() : undefined,
  });

// One call: published course + started open batch + active student
export const createLearningSetup = async (courseOptions: CourseOptions = {}, cohortOptions: CohortOptions = {}) => {
  const { course, modules, lessons } = await createCourse(courseOptions);
  const cohort = await createCohort(course._id as Types.ObjectId, cohortOptions);
  const student = await createStudent();
  const enrollment = await createEnrollment(
    student.user._id as Types.ObjectId,
    course._id as Types.ObjectId,
    cohort._id as Types.ObjectId
  );
  return { course, modules, lessons, cohort, student, enrollment };
};

// Quiz with 4 single-choice questions (correct = option 0 for q1-q3, option 1
// for q4) + 1 multiple-choice (correct = [0, 2]). 1 point each → 20% per question.
export const createQuiz = async (courseId: Types.ObjectId, moduleId: Types.ObjectId, passPercent = 60) =>
  Quiz.create({
    courseId,
    moduleId,
    passPercent,
    questions: [
      { prompt: 'Q1', options: ['right', 'wrong'], correctOptionIndexes: [0], explanation: 'E1' },
      { prompt: 'Q2', options: ['right', 'wrong', 'wrong'], correctOptionIndexes: [0], explanation: 'E2' },
      { prompt: 'Q3', options: ['right', 'wrong'], correctOptionIndexes: [0], explanation: 'E3' },
      { prompt: 'Q4', options: ['wrong', 'right'], correctOptionIndexes: [1], explanation: 'E4' },
      { prompt: 'Q5', type: 'multiple', options: ['yes', 'no', 'yes', 'no'], correctOptionIndexes: [0, 2], explanation: 'E5' },
    ],
  });
