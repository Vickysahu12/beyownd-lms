// src/services/enrollment.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Ek enrolled student ka learning flow: "meri courses", ek course ka
// dashboard, lesson kholna, lesson complete karna.
//
// ACCESS RULES (har lesson request pe, server pe - frontend ka lock icon
// sirf display hai):
//   1. Enrollment TUMHARI honi chahiye → warna 404 (403 nahi - taaki
//      doosre ka ID guess karke "exists" bhi pata na chale)
//   2. Status active/completed → warna ENROLLMENT_NOT_ACTIVE
//   3. Cohort shuru ho chuka ho (D10) → warna COHORT_NOT_STARTED
//      (free-preview modules hamesha khule)
//   4. Module unlocked ho → warna MODULE_LOCKED
//
// UNLOCK RULE: module 1 hamesha khula; module N tab khulta hai jab N-1
// complete ho. "Complete" = saare lessons done + quiz passed (agar module
// mein quiz hai - Phase 2). Yeh STORE nahi hota, har baar progress se
// compute hota hai.
//
// Outline aur lesson content catalog.service ke Redis cache se aate hai -
// sirf enrollment (student ka apna data) DB se fresh padha jaata hai.
// ────────────────────────────────────────────────────────────────────────

import { isValidObjectId, Types } from 'mongoose';
import Enrollment, { IEnrollment, IModuleProgress } from '../models/enrollment.model';
import Course from '../models/course.model';
import Cohort, { ICohort } from '../models/cohort.model';
import { AppError } from '../utils/AppError';
import { getOutline, getLessonContent, Outline, OutlineModule, LessonContent } from './catalog.service';

export const ACCESSIBLE_STATUSES = ['active', 'completed'];

// ---- pure helpers (DB nahi chhoote - unit-test friendly) ----

export interface ModuleState {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  hasQuiz: boolean;
  unlocked: boolean;
  completed: boolean;
  quizPassed: boolean;
  lessonsCompleted: number;
  lessonsTotal: number;
  lessons: { id: string; title: string; order: number; type: string; estimatedMinutes: number; completed: boolean }[];
}

const progressFor = (enrollment: IEnrollment, moduleId: string): IModuleProgress | undefined =>
  enrollment.progress.find((p) => String(p.moduleId) === moduleId);

export const isModuleComplete = (module: OutlineModule, progress?: IModuleProgress): boolean => {
  if (!progress) return false;
  if (progress.completedAt) return true;
  const done = new Set(progress.completedLessonIds.map(String));
  const allLessons = module.lessons.length > 0 && module.lessons.every((l) => done.has(l.id));
  return allLessons && (!module.hasQuiz || progress.quizPassed);
};

export const computeModuleStates = (outline: Outline, enrollment: IEnrollment): ModuleState[] => {
  let previousComplete = true; // pehla module hamesha unlocked
  return outline.modules.map((module) => {
    const progress = progressFor(enrollment, module.id);
    const done = new Set((progress?.completedLessonIds ?? []).map(String));
    const completed = isModuleComplete(module, progress);
    const state: ModuleState = {
      id: module.id,
      title: module.title,
      order: module.order,
      isFreePreview: module.isFreePreview,
      hasQuiz: module.hasQuiz,
      unlocked: previousComplete,
      completed,
      quizPassed: progress?.quizPassed ?? false,
      lessonsCompleted: module.lessons.filter((l) => done.has(l.id)).length,
      lessonsTotal: module.lessons.length,
      lessons: module.lessons.map((l) => ({ ...l, completed: done.has(l.id) })),
    };
    previousComplete = completed;
    return state;
  });
};

export const percentComplete = (states: ModuleState[]): number => {
  const total = states.reduce((s, m) => s + m.lessonsTotal, 0);
  if (total === 0) return 0;
  const done = states.reduce((s, m) => s + m.lessonsCompleted, 0);
  return Math.round((done / total) * 100);
};

// ---- loaders ----

// Rule 1: sirf apni enrollment. Galat/doosre ka ID → same 404.
export const loadOwnEnrollment = async (enrollmentId: string, userId: string): Promise<IEnrollment> => {
  if (!isValidObjectId(enrollmentId)) throw AppError.notFound('Enrollment not found');
  const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId });
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  return enrollment;
};

export const loadCohort = async (cohortId: Types.ObjectId): Promise<ICohort> => {
  const cohort = await Cohort.findById(cohortId);
  if (!cohort) throw AppError.notFound('Cohort not found');
  return cohort;
};

// Rules 2-4 ek jagah - lesson padhna aur complete karna dono yahi use karte hai
export const assertModuleAccessible = (enrollment: IEnrollment, cohort: ICohort, state: ModuleState) => {
  if (!ACCESSIBLE_STATUSES.includes(enrollment.status)) {
    throw AppError.forbidden('Your enrollment is not active', 'ENROLLMENT_NOT_ACTIVE');
  }
  if (!state.isFreePreview && new Date() < cohort.startDate) {
    throw AppError.forbidden(
      `Your batch starts on ${cohort.startDate.toDateString()}`,
      'COHORT_NOT_STARTED'
    );
  }
  if (!state.unlocked) {
    throw AppError.forbidden('Complete the previous module first', 'MODULE_LOCKED');
  }
};

// Lesson isi enrollment ke course ka hona chahiye, aur outline mein hona chahiye
const resolveLesson = async (enrollment: IEnrollment, lessonId: string) => {
  const lesson = await getLessonContent(lessonId);
  if (!lesson || lesson.courseId !== String(enrollment.courseId)) {
    throw AppError.notFound('Lesson not found');
  }
  const outline = await getOutline(String(enrollment.courseId));
  const states = computeModuleStates(outline, enrollment);
  const state = states.find((s) => s.id === lesson.moduleId);
  if (!state) throw AppError.notFound('Lesson not found');
  return { lesson, outline, states, state };
};

// Quiz ke liye: module isi enrollment ke course ka ho (outline mein mile)
export const resolveModule = async (enrollment: IEnrollment, moduleId: string) => {
  if (!isValidObjectId(moduleId)) throw AppError.notFound('Module not found');
  const outline = await getOutline(String(enrollment.courseId));
  const states = computeModuleStates(outline, enrollment);
  const index = states.findIndex((s) => s.id === moduleId);
  if (index === -1) throw AppError.notFound('Module not found');
  return { outline, states, state: states[index], module: outline.modules[index], index };
};

// Module ki progress entry nahi hai to banao. Filter mein `$ne` hai - do
// parallel requests dono entry nahi bana sakti (single-document update atomic).
export const ensureProgressEntry = async (enrollmentId: Types.ObjectId, moduleId: Types.ObjectId) => {
  await Enrollment.updateOne(
    { _id: enrollmentId, 'progress.moduleId': { $ne: moduleId } },
    { $push: { progress: { moduleId, completedLessonIds: [], quizPassed: false, bestQuizScorePercent: 0 } } }
  );
};

// Progress update ke BAAD call karo: module abhi complete hua? To
// completedAt set (sirf pehli baar - arrayFilters condition) aur batao
// agla module khula ya nahi. Lesson complete aur quiz pass dono yahi use karte hai.
export const settleModuleCompletion = async (
  outline: Outline,
  before: IEnrollment,
  after: IEnrollment,
  moduleId: string
) => {
  const beforeStates = computeModuleStates(outline, before);
  const afterStates = computeModuleStates(outline, after);
  const index = afterStates.findIndex((s) => s.id === moduleId);
  const moduleCompleted = afterStates[index].completed;
  const justCompleted = moduleCompleted && !beforeStates[index].completed;

  if (justCompleted) {
    await Enrollment.updateOne(
      { _id: after._id },
      { $set: { 'progress.$[p].completedAt': new Date() } },
      { arrayFilters: [{ 'p.moduleId': new Types.ObjectId(moduleId), 'p.completedAt': { $exists: false } }] }
    );
  }

  const next = afterStates[index + 1];
  return {
    moduleCompleted,
    nextModuleUnlocked: justCompleted && next ? { id: next.id, title: next.title } : null,
    percentComplete: percentComplete(afterStates),
  };
};

// ---- public functions ----

export const listMyEnrollments = async (userId: string) => {
  const enrollments = await Enrollment.find({ userId, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
  if (enrollments.length === 0) return [];

  // Courses + cohorts EK-EK query mein (N+1 nahi)
  const [courses, cohorts] = await Promise.all([
    Course.find({ _id: { $in: enrollments.map((e) => e.courseId) } }).select({ title: 1, slug: 1, thumbnailUrl: 1 }),
    Cohort.find({ _id: { $in: enrollments.map((e) => e.cohortId) } }).select({ name: 1, code: 1, startDate: 1, endDate: 1 }),
  ]);

  return Promise.all(
    enrollments.map(async (e) => {
      const course = courses.find((c) => String(c._id) === String(e.courseId));
      const cohort = cohorts.find((c) => String(c._id) === String(e.cohortId));
      const states = computeModuleStates(await getOutline(String(e.courseId)), e);
      return {
        id: String(e._id),
        status: e.status,
        course: course ? { id: String(course._id), title: course.title, slug: course.slug, thumbnailUrl: course.thumbnailUrl ?? null } : null,
        cohort: cohort
          ? { id: String(cohort._id), name: cohort.name, code: cohort.code, startDate: cohort.startDate, endDate: cohort.endDate }
          : null,
        percentComplete: percentComplete(states),
        projectStatus: e.projectStatus,
      };
    })
  );
};

export const getDashboard = async (enrollmentId: string, userId: string) => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  const [cohort, course, outline] = await Promise.all([
    loadCohort(enrollment.cohortId),
    Course.findById(enrollment.courseId).select({ title: 1, slug: 1, project: 1 }),
    getOutline(String(enrollment.courseId)),
  ]);
  const states = computeModuleStates(outline, enrollment);
  const active = ACCESSIBLE_STATUSES.includes(enrollment.status);

  return {
    id: String(enrollment._id),
    status: enrollment.status,
    course: course ? { id: String(course._id), title: course.title, slug: course.slug, projectTitle: course.project.title } : null,
    cohort: {
      id: String(cohort._id),
      name: cohort.name,
      code: cohort.code,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      started: new Date() >= cohort.startDate,
      // Community link sirf paid (active) students ko
      communityLink: active ? cohort.communityLink ?? null : null,
    },
    percentComplete: percentComplete(states),
    modules: states,
    projectStatus: enrollment.projectStatus,
    completedAt: enrollment.completedAt ?? null,
  };
};

export const getLesson = async (
  enrollmentId: string,
  userId: string,
  lessonId: string
): Promise<LessonContent & { completed: boolean; previousLessonId: string | null; nextLessonId: string | null }> => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  const { lesson, outline, state } = await resolveLesson(enrollment, lessonId);
  assertModuleAccessible(enrollment, await loadCohort(enrollment.cohortId), state);

  // Prev/next poore course ke order mein - "Next lesson" button ke liye
  const flat = outline.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const index = flat.indexOf(lesson.id);

  return {
    ...lesson,
    completed: state.lessons.find((l) => l.id === lesson.id)?.completed ?? false,
    previousLessonId: index > 0 ? flat[index - 1] : null,
    nextLessonId: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
};

export const completeLesson = async (enrollmentId: string, userId: string, lessonId: string) => {
  const enrollment = await loadOwnEnrollment(enrollmentId, userId);
  const { lesson, outline, state } = await resolveLesson(enrollment, lessonId);
  assertModuleAccessible(enrollment, await loadCohort(enrollment.cohortId), state);

  const moduleObjectId = new Types.ObjectId(lesson.moduleId);

  // Step 1: progress entry (atomic, duplicate-safe)
  await ensureProgressEntry(enrollment._id as Types.ObjectId, moduleObjectId);

  // Step 2: lesson add - $addToSet, do baar mark karo to bhi ek hi baar
  const updated = await Enrollment.findOneAndUpdate(
    { _id: enrollment._id, 'progress.moduleId': moduleObjectId },
    { $addToSet: { 'progress.$.completedLessonIds': new Types.ObjectId(lesson.id) } },
    { new: true }
  );
  if (!updated) throw AppError.notFound('Enrollment not found');

  // Step 3: module ab complete hua? (sirf pehli baar completedAt)
  return { lessonId: lesson.id, ...(await settleModuleCompletion(outline, enrollment, updated, lesson.moduleId)) };
};
