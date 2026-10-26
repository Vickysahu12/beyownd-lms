// src/services/admin/content.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Admin content editor ka backend: courses, modules, lessons, quizzes -
// banana, badalna, reorder, publish.
//
// RULES:
// - Har change ke baad us course ka Redis cache turant clear (catalog,
//   outline, lesson, quiz) - students ko purana content nahi dikhta.
// - PUBLISH tabhi jab course "complete" ho: kam se kam ek module, har module
//   mein kam se kam ek lesson (COURSE_INCOMPLETE).
// - MODULE DELETE sirf tab jab course mein koi active/completed student na
//   ho (COURSE_HAS_STUDENTS) - beech batch mein module hatane se unlock
//   sequence badal jaata. Lessons fix/delete kabhi bhi (audit ke saath).
// - REORDER: { courseId, order } unique hai, isliye seedha swap nahi ho
//   sakta (beech mein do same order). Transaction mein do phase: pehle sab
//   negative temp orders, phir final 1..N.
// - Quiz save document.save() se - question-level validation hooks (sahi
//   option index, single = ek answer) update queries mein nahi chalte.
// - Publish/archive/delete audit log mein.
// ────────────────────────────────────────────────────────────────────────

import mongoose, { isValidObjectId, Types } from 'mongoose';
import Course, { ICourse } from '../../models/course.model';
import Module, { IModule } from '../../models/module.model';
import Lesson from '../../models/lesson.model';
import { assertValidStoredLesson } from '../content/lessonContent.service';
import { analyzeLesson, findQuizLeaks } from '../content/lessonFormat';
import Quiz from '../../models/quiz.model';
import Enrollment from '../../models/enrollment.model';
import { AppError } from '../../utils/AppError';
import { writeAudit } from '../../utils/audit.util';
import { invalidateCourseCache } from '../catalog.service';

// ---- helpers ----

const assertId = (id: string, what: string) => {
  if (!isValidObjectId(id)) throw AppError.notFound(`${what} not found`);
};

const loadCourse = async (id: string) => {
  assertId(id, 'Course');
  const course = await Course.findById(id);
  if (!course) throw AppError.notFound('Course not found');
  return course;
};

const loadModule = async (id: string) => {
  assertId(id, 'Module');
  const module = await Module.findById(id);
  if (!module) throw AppError.notFound('Module not found');
  return module;
};

const loadLesson = async (id: string) => {
  assertId(id, 'Lesson');
  const lesson = await Lesson.findById(id);
  if (!lesson) throw AppError.notFound('Lesson not found');
  return lesson;
};

// Course ka poora cache clear - catalog, outline, saare lessons, saare quizzes
const refreshCourseCache = async (courseId: Types.ObjectId | string, extraSlugs: string[] = []) => {
  const course = await Course.findById(courseId).select({ slug: 1 });
  if (!course) return;
  const [lessons, modules] = await Promise.all([
    Lesson.find({ courseId }).select({ _id: 1 }),
    Module.find({ courseId }).select({ _id: 1 }),
  ]);
  const lessonIds = lessons.map((l) => String(l._id));
  const moduleIds = modules.map((m) => String(m._id));
  await invalidateCourseCache({ id: String(courseId), slug: course.slug }, lessonIds, moduleIds);
  for (const slug of extraSlugs) await invalidateCourseCache({ id: String(courseId), slug });
};

const hasStudents = async (courseId: Types.ObjectId | string) =>
  Boolean(await Enrollment.exists({ courseId, status: { $in: ['active', 'completed'] } }));

const nextOrder = async (model: typeof Module | typeof Lesson, filter: Record<string, unknown>) => {
  const last = await (model as typeof Module).findOne(filter).sort({ order: -1 }).select({ order: 1 });
  return (last?.order ?? 0) + 1;
};

// ---- Courses ----

export type CourseInput = Partial<
  Pick<ICourse, 'title' | 'slug' | 'tagline' | 'description' | 'thumbnailUrl' | 'level' | 'skills' | 'durationWeeks' | 'defaultPricePaise' | 'project' | 'status'>
>;

export const listCourses = async () => {
  const courses = await Course.find().sort({ createdAt: -1 }).limit(200);
  const ids = courses.map((c) => c._id);
  const [moduleCounts, lessonCounts, studentCounts] = await Promise.all([
    Module.aggregate([{ $match: { courseId: { $in: ids } } }, { $group: { _id: '$courseId', n: { $sum: 1 } } }]),
    Lesson.aggregate([{ $match: { courseId: { $in: ids } } }, { $group: { _id: '$courseId', n: { $sum: 1 } } }]),
    Enrollment.aggregate([
      { $match: { courseId: { $in: ids }, status: { $in: ['active', 'completed'] } } },
      { $group: { _id: '$courseId', n: { $sum: 1 } } },
    ]),
  ]);
  const count = (rows: { _id: unknown; n: number }[], id: unknown) => rows.find((r) => String(r._id) === String(id))?.n ?? 0;

  return courses.map((c) => ({
    id: String(c._id),
    title: c.title,
    slug: c.slug,
    status: c.status,
    modules: count(moduleCounts, c._id),
    lessons: count(lessonCounts, c._id),
    students: count(studentCounts, c._id),
    defaultPricePaise: c.defaultPricePaise,
    updatedAt: c.updatedAt,
  }));
};

export const createCourse = async (actorId: string, input: CourseInput) => {
  try {
    const course = await Course.create({ ...input, status: 'draft', createdBy: actorId });
    await writeAudit(actorId, 'course.create', 'Course', course._id, { slug: course.slug });
    return course;
  } catch (err: any) {
    if (err?.code === 11000) throw AppError.conflict('A course with this slug already exists', 'SLUG_TAKEN');
    throw err;
  }
};

// Editor ke liye poora structure: modules → lessons (titles) + quiz info
export const getCourseStructure = async (courseId: string) => {
  const course = await loadCourse(courseId);
  const [modules, lessons, quizzes] = await Promise.all([
    Module.find({ courseId }).sort({ order: 1 }),
    Lesson.find({ courseId }).sort({ order: 1 }).select({ moduleId: 1, title: 1, order: 1, type: 1, estimatedMinutes: 1, updatedAt: 1 }),
    Quiz.find({ courseId }).select({ moduleId: 1, passPercent: 1, questions: 1 }),
  ]);
  return {
    course,
    modules: modules.map((m) => {
      const quiz = quizzes.find((q) => String(q.moduleId) === String(m._id));
      return {
        id: String(m._id),
        title: m.title,
        description: m.description ?? null,
        order: m.order,
        isFreePreview: m.isFreePreview,
        quiz: quiz ? { passPercent: quiz.passPercent, questions: quiz.questions.length } : null,
        lessons: lessons
          .filter((l) => String(l.moduleId) === String(m._id))
          .map((l) => ({ id: String(l._id), title: l.title, order: l.order, type: l.type, estimatedMinutes: l.estimatedMinutes })),
      };
    }),
    hasStudents: await hasStudents(courseId),
  };
};

const assertPublishable = async (courseId: Types.ObjectId | string) => {
  const modules = await Module.find({ courseId }).select({ _id: 1, title: 1 });
  if (modules.length === 0) throw AppError.badRequest('Add at least one module before publishing', 'COURSE_INCOMPLETE');
  const withLessons = await Lesson.distinct('moduleId', { courseId });
  const empty = modules.filter((m) => !withLessons.some((id) => String(id) === String(m._id)));
  if (empty.length) {
    throw AppError.badRequest(`Module "${empty[0].title}" has no lessons yet`, 'COURSE_INCOMPLETE');
  }
};

export const updateCourse = async (actorId: string, courseId: string, input: CourseInput) => {
  const course = await loadCourse(courseId);
  const oldSlug = course.slug;
  const oldStatus = course.status;

  if (input.status === 'published' && oldStatus !== 'published') await assertPublishable(course._id);

  course.set(input);
  try {
    await course.save();
  } catch (err: any) {
    if (err?.code === 11000) throw AppError.conflict('A course with this slug already exists', 'SLUG_TAKEN');
    throw err;
  }

  if (input.status && input.status !== oldStatus) {
    await writeAudit(actorId, `course.${input.status === 'published' ? 'publish' : input.status === 'archived' ? 'archive' : 'unpublish'}`, 'Course', course._id, { from: oldStatus, to: input.status });
  }
  await refreshCourseCache(course._id, oldSlug !== course.slug ? [oldSlug] : []);
  return course;
};

// ---- Modules ----

export type ModuleInput = Partial<Pick<IModule, 'title' | 'description' | 'isFreePreview'>>;

export const addModule = async (courseId: string, input: ModuleInput) => {
  const course = await loadCourse(courseId);
  const module = await Module.create({ ...input, courseId: course._id, order: await nextOrder(Module, { courseId: course._id }) });
  await refreshCourseCache(course._id);
  return module;
};

export const updateModule = async (moduleId: string, input: ModuleInput) => {
  const module = await loadModule(moduleId);
  module.set(input);
  await module.save();
  await refreshCourseCache(module.courseId);
  return module;
};

export const deleteModule = async (actorId: string, moduleId: string) => {
  const module = await loadModule(moduleId);
  if (await hasStudents(module.courseId)) {
    throw AppError.conflict('Students are enrolled in this course - modules can no longer be deleted', 'COURSE_HAS_STUDENTS');
  }
  const lessonIds = (await Lesson.find({ moduleId }).select({ _id: 1 })).map((l) => String(l._id));
  await refreshCourseCache(module.courseId); // clear lesson caches before the ids disappear
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Lesson.deleteMany({ moduleId }, { session });
      await Quiz.deleteMany({ moduleId }, { session });
      await Module.deleteOne({ _id: moduleId }, { session });
      await writeAudit(actorId, 'module.delete', 'Module', module._id, { title: module.title, lessons: lessonIds.length }, session);
    });
  } finally {
    await session.endSession();
  }
  await refreshCourseCache(module.courseId);
};

// Generic two-phase reorder for modules (by course) or lessons (by module)
const reorder = async (
  model: typeof Module | typeof Lesson,
  scope: Record<string, unknown>,
  orderedIds: string[],
  what: string
) => {
  const existing = (await (model as typeof Module).find(scope).select({ _id: 1 })).map((d) => String(d._id));
  const same = existing.length === orderedIds.length && new Set(orderedIds).size === orderedIds.length && orderedIds.every((id) => existing.includes(id));
  if (!same) throw AppError.badRequest(`Send every ${what} of this ${what === 'module' ? 'course' : 'module'} exactly once`, 'REORDER_INVALID');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Phase 1: temp negative orders (unique index ko clash se bachane ke liye)
      await (model as typeof Module).bulkWrite(
        orderedIds.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: -(i + 1) } } } })),
        { session }
      );
      // Phase 2: final 1..N
      await (model as typeof Module).bulkWrite(
        orderedIds.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i + 1 } } } })),
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

export const reorderModules = async (courseId: string, moduleIds: string[]) => {
  const course = await loadCourse(courseId);
  await reorder(Module, { courseId: course._id }, moduleIds, 'module');
  await refreshCourseCache(course._id);
};

// ---- Lessons ----

export interface LessonInput {
  title?: string;
  type?: 'text' | 'video';
  content?: string;
  videoYoutubeId?: string | null;
  estimatedMinutes?: number;
}

// Rich-lesson format check (docs/content/LESSON_FORMAT.md) - only when the
// content (or type) actually changes, so old lessons can still be renamed.
// Errors → 400 LESSON_FORMAT_INVALID with every line; warnings go back to the editor.
const checkLessonContent = async (lesson: InstanceType<typeof Lesson>) => {
  if (!lesson.isNew && !lesson.isModified('content') && !lesson.isModified('type')) return [];
  const check = await assertValidStoredLesson(lesson.content ?? '', lesson.type);
  const quiz = await Quiz.findOne({ moduleId: lesson.moduleId }).select({ 'questions.prompt': 1 });
  if (quiz) {
    const { quizQuestions } = analyzeLesson(lesson.content ?? '', { mode: 'stored' });
    const leaks = findQuizLeaks(quizQuestions, quiz.questions.map((q) => q.prompt));
    if (leaks.length) {
      throw new AppError(400, `Line ${leaks[0].line}: ${leaks[0].message}`, 'LESSON_FORMAT_INVALID', { errors: leaks, warnings: check.warnings });
    }
  }
  return check.warnings;
};

export const addLesson = async (moduleId: string, input: LessonInput) => {
  const module = await loadModule(moduleId);
  const lesson = new Lesson({
    ...input,
    videoYoutubeId: input.videoYoutubeId ?? undefined,
    courseId: module.courseId,
    moduleId: module._id,
    order: await nextOrder(Lesson, { moduleId: module._id }),
  });
  const warnings = await checkLessonContent(lesson);
  await lesson.save(); // save() → video-needs-YouTube-ID hook chalta hai
  await refreshCourseCache(module.courseId);
  return { lesson, warnings };
};

export const getLesson = loadLesson;

export const updateLesson = async (lessonId: string, input: LessonInput) => {
  const lesson = await loadLesson(lessonId);
  lesson.set({ ...input, ...(input.videoYoutubeId === null ? { videoYoutubeId: undefined } : {}) });
  const warnings = await checkLessonContent(lesson);
  await lesson.save();
  await refreshCourseCache(lesson.courseId);
  return { lesson, warnings };
};

export const deleteLesson = async (actorId: string, lessonId: string) => {
  const lesson = await loadLesson(lessonId);
  await refreshCourseCache(lesson.courseId);
  await Lesson.deleteOne({ _id: lesson._id });
  await writeAudit(actorId, 'lesson.delete', 'Lesson', lesson._id, { title: lesson.title, moduleId: lesson.moduleId });
  await refreshCourseCache(lesson.courseId);
};

export const reorderLessons = async (moduleId: string, lessonIds: string[]) => {
  const module = await loadModule(moduleId);
  await reorder(Lesson, { moduleId: module._id }, lessonIds, 'lesson');
  await refreshCourseCache(module.courseId);
};

// ---- Quiz ----

export interface QuizInput {
  passPercent?: number;
  questions: {
    prompt: string;
    type?: 'single' | 'multiple';
    options: string[];
    correctOptionIndexes: number[];
    explanation?: string;
    points?: number;
  }[];
}

export const getQuiz = async (moduleId: string) => {
  await loadModule(moduleId);
  return Quiz.findOne({ moduleId }); // admin view - answers included
};

export const upsertQuiz = async (moduleId: string, input: QuizInput) => {
  const module = await loadModule(moduleId);
  const quiz = (await Quiz.findOne({ moduleId })) ?? new Quiz({ moduleId: module._id, courseId: module.courseId });
  quiz.set({ passPercent: input.passPercent ?? quiz.passPercent ?? 60, questions: input.questions });
  const lessons = await Lesson.find({ moduleId: module._id }).select({ title: 1, content: 1 });
  for (const l of lessons) {
    const leaks = findQuizLeaks(analyzeLesson(l.content ?? '', { mode: 'stored' }).quizQuestions, input.questions.map((q) => q.prompt));
    if (leaks.length) {
      throw AppError.badRequest(`A question is also a practice quiz in lesson "${l.title}" (line ${leaks[0].line}) - students already see its answer there`, 'QUIZ_ANSWER_LEAK');
    }
  }
  await quiz.save(); // question-level validation (option ranges, single = 1 answer)
  await refreshCourseCache(module.courseId);
  return quiz;
};

export const deleteQuiz = async (moduleId: string) => {
  const module = await loadModule(moduleId);
  await Quiz.deleteOne({ moduleId });
  await refreshCourseCache(module.courseId);
};
