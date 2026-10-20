// src/services/catalog.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Public catalog (bina login ke): courses ki list, ek course ka detail +
// outline, open batches, aur free-preview lessons.
//
// Yeh site ke sabse zyada hit hone wale pages hai (landing → courses), aur
// content kabhi-kabhi badalta hai → sab Redis mein cached. Pehli request
// ke baad MongoDB touch hi nahi hota (TTL ya admin edit tak).
//
// Outline + lesson functions enrollment.service bhi use karta hai - same
// cache, same data, do jagah alag logic nahi.
//
// Sab functions PLAIN objects return karte hai (string IDs) - taaki cache
// mein JSON ban sake aur response mein koi internal field na jaye.
// ────────────────────────────────────────────────────────────────────────

import { isValidObjectId, Types } from 'mongoose';
import Course, { ICourse } from '../models/course.model';
import Module from '../models/module.model';
import Lesson from '../models/lesson.model';
import Cohort, { ICohort } from '../models/cohort.model';
import Quiz from '../models/quiz.model';
import { AppError } from '../utils/AppError';
import { getOrSet, invalidate, cacheKeys } from '../utils/cache';

const CATALOG_TTL = 600; // 10 min
const LESSON_TTL = 1800; // 30 min
const COHORTS_TTL = 60; // seats badalte rehte hai - chhota TTL

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---- DTO types (yahi client ko jaata hai) ----

export interface OutlineLesson {
  id: string;
  title: string;
  order: number;
  type: 'text' | 'video';
  estimatedMinutes: number;
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  order: number;
  isFreePreview: boolean;
  // true → module tabhi complete jab lessons done + quiz pass
  hasQuiz: boolean;
  lessons: OutlineLesson[];
}

export interface Outline {
  courseId: string;
  modules: OutlineModule[];
  totalLessons: number;
  totalMinutes: number;
}

export interface CohortSummary {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  enrollOpensAt: string;
  enrollClosesAt: string;
  pricePaise: number;
  seatsLeft: number;
  enrollable: boolean;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  thumbnailUrl: string | null;
  level: string;
  skills: string[];
  durationWeeks: number;
  fromPricePaise: number;
  nextCohortStartDate: string | null;
}

export interface CourseDetail extends Omit<CourseCard, 'fromPricePaise' | 'nextCohortStartDate'> {
  description: string;
  project: { title: string };
  outline: Outline;
}

export interface LessonContent {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  order: number;
  type: 'text' | 'video';
  content: string;
  videoYoutubeId: string | null;
  estimatedMinutes: number;
}

// ---- helpers ----

const toCohortSummary = (c: ICohort, now = new Date()): CohortSummary => {
  const seatsLeft = Math.max(0, c.capacity - c.seatsTaken);
  return {
    id: String(c._id),
    name: c.name,
    code: c.code,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    enrollOpensAt: c.enrollOpensAt.toISOString(),
    enrollClosesAt: c.enrollClosesAt.toISOString(),
    pricePaise: c.pricePaise,
    seatsLeft,
    enrollable: c.status === 'open' && now >= c.enrollOpensAt && now < c.enrollClosesAt && seatsLeft > 0,
  };
};

// "Listed" batches: admin ne open kiya hai aur enrollment band nahi hua
const listedCohortsFilter = (courseIds: (Types.ObjectId | string)[]) => ({
  courseId: { $in: courseIds.map((id) => new Types.ObjectId(String(id))) },
  status: 'open' as const,
  enrollClosesAt: { $gt: new Date() },
});

const toCardBase = (c: ICourse) => ({
  id: String(c._id),
  slug: c.slug,
  title: c.title,
  tagline: c.tagline ?? null,
  thumbnailUrl: c.thumbnailUrl ?? null,
  level: c.level,
  skills: [...c.skills],
  durationWeeks: c.durationWeeks,
});

// ---- public functions ----

export const listPublishedCourses = (): Promise<CourseCard[]> =>
  getOrSet(cacheKeys.publishedCourses(), CATALOG_TTL, async () => {
    const courses = await Course.find({ status: 'published' }).sort({ createdAt: -1 }).limit(50);
    if (courses.length === 0) return [];

    // Saare courses ke batches EK query mein (N+1 nahi)
    const cohorts = await Cohort.find(listedCohortsFilter(courses.map((c) => c._id))).sort({ startDate: 1 });

    return courses.map((course) => {
      const own = cohorts.filter((c) => String(c.courseId) === String(course._id));
      return {
        ...toCardBase(course),
        fromPricePaise: own.length ? Math.min(...own.map((c) => c.pricePaise)) : course.defaultPricePaise,
        nextCohortStartDate: own[0]?.startDate.toISOString() ?? null,
      };
    });
  });

export const getOutline = (courseId: string): Promise<Outline> =>
  getOrSet(cacheKeys.outline(courseId), CATALOG_TTL, async () => {
    // Teen queries poore course ke liye - modules, saare lessons (sirf
    // title wagaira, `content` NAHI - woh bada hai, alag load hota hai), aur
    // kin modules mein quiz hai (sirf moduleId)
    const [modules, lessons, quizzes] = await Promise.all([
      Module.find({ courseId }).sort({ order: 1 }),
      Lesson.find({ courseId })
        .sort({ moduleId: 1, order: 1 })
        .select({ moduleId: 1, title: 1, order: 1, type: 1, estimatedMinutes: 1 }),
      Quiz.find({ courseId }).select({ moduleId: 1 }),
    ]);
    const modulesWithQuiz = new Set(quizzes.map((q) => String(q.moduleId)));

    const outlineModules: OutlineModule[] = modules.map((m) => ({
      id: String(m._id),
      title: m.title,
      description: m.description ?? null,
      order: m.order,
      isFreePreview: m.isFreePreview,
      hasQuiz: modulesWithQuiz.has(String(m._id)),
      lessons: lessons
        .filter((l) => String(l.moduleId) === String(m._id))
        .map((l) => ({
          id: String(l._id),
          title: l.title,
          order: l.order,
          type: l.type,
          estimatedMinutes: l.estimatedMinutes,
        })),
    }));

    return {
      courseId,
      modules: outlineModules,
      totalLessons: lessons.length,
      totalMinutes: lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0),
    };
  });

export const getCourseBySlug = async (slug: string): Promise<CourseDetail> => {
  if (!SLUG_PATTERN.test(slug)) throw AppError.notFound('Course not found');

  const detail = await getOrSet<CourseDetail | null>(cacheKeys.courseBySlug(slug), CATALOG_TTL, async () => {
    const course = await Course.findOne({ slug, status: 'published' });
    if (!course) return null;
    return {
      ...toCardBase(course),
      description: course.description,
      project: { title: course.project.title },
      outline: await getOutline(String(course._id)),
    };
  });

  if (!detail) throw AppError.notFound('Course not found');
  return detail;
};

export const getCourseCohorts = async (slug: string): Promise<CohortSummary[]> => {
  const course = await getCourseBySlug(slug);
  return getOrSet(cacheKeys.courseCohorts(course.id), COHORTS_TTL, async () => {
    const cohorts = await Cohort.find(listedCohortsFilter([course.id])).sort({ startDate: 1 });
    return cohorts.map((c) => toCohortSummary(c));
  });
};

export const getLessonContent = async (lessonId: string): Promise<LessonContent | null> => {
  if (!isValidObjectId(lessonId)) return null;
  return getOrSet<LessonContent | null>(cacheKeys.lesson(lessonId), LESSON_TTL, async () => {
    const l = await Lesson.findById(lessonId);
    if (!l) return null;
    return {
      id: String(l._id),
      courseId: String(l.courseId),
      moduleId: String(l.moduleId),
      title: l.title,
      order: l.order,
      type: l.type,
      content: l.content,
      videoYoutubeId: l.videoYoutubeId ?? null,
      estimatedMinutes: l.estimatedMinutes,
    };
  });
};

// Free preview: lesson tabhi milega jab woh isi course ka ho AUR uska
// module `isFreePreview` ho. Baaki sab ke liye enrollment chahiye.
export const getPreviewLesson = async (slug: string, lessonId: string): Promise<LessonContent> => {
  const course = await getCourseBySlug(slug);
  const lesson = await getLessonContent(lessonId);
  if (!lesson || lesson.courseId !== course.id) throw AppError.notFound('Lesson not found');

  const module = course.outline.modules.find((m) => m.id === lesson.moduleId);
  if (!module?.isFreePreview) {
    throw AppError.forbidden('Enroll to access this lesson', 'PREVIEW_NOT_AVAILABLE');
  }
  return lesson;
};

// Admin panel (Phase 5) content edit ke baad call karega
// (quiz edit pe quizModuleIds bhi do - quiz cache + outline ka hasQuiz dono)
export const invalidateCourseCache = async (
  course: { id: string; slug: string },
  lessonIds: string[] = [],
  quizModuleIds: string[] = []
) => {
  await invalidate(
    cacheKeys.publishedCourses(),
    cacheKeys.courseBySlug(course.slug),
    cacheKeys.outline(course.id),
    cacheKeys.courseCohorts(course.id),
    ...lessonIds.map((id) => cacheKeys.lesson(id)),
    ...quizModuleIds.map((id) => cacheKeys.quiz(id))
  );
};
