/** Client-safe catalog types and formatters. Data fetching lives in catalog.server.ts. */

/** Shape of GET /api/courses items (docs/design/api-routes.md §5). */
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

export function formatRupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** Dates are stored in UTC; students read them in IST. */
export function formatBatchDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

/** Generic cover art until a course has its own thumbnail. */
export function coverFor(course: Pick<CourseCard, "slug" | "title" | "thumbnailUrl">) {
  if (course.thumbnailUrl) return course.thumbnailUrl;
  const key = `${course.slug} ${course.title}`.toLowerCase();
  if (/data|ml|ai|analytics|machine/.test(key)) return "/illustrations/cover-data.svg";
  if (/design|ui|ux|figma/.test(key)) return "/illustrations/cover-design.svg";
  if (/android|mobile|flutter|ios|app/.test(key)) return "/illustrations/cover-mobile.svg";
  if (/web|front|back|stack|react|node|javascript/.test(key)) return "/illustrations/cover-web.svg";
  return "/illustrations/cover-default.svg";
}

/* ---------- Program detail (GET /courses/:slug, /cohorts, /preview/lessons/:id) ---------- */

export interface OutlineLesson {
  id: string;
  title: string;
  order: number;
  type: "text" | "video";
  estimatedMinutes: number;
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  order: number;
  isFreePreview: boolean;
  hasQuiz: boolean;
  lessons: OutlineLesson[];
}

export interface CourseDetail extends Omit<CourseCard, "fromPricePaise" | "nextCohortStartDate"> {
  description: string;
  project: { title: string };
  outline: { courseId: string; modules: OutlineModule[]; totalLessons: number; totalMinutes: number };
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

export interface LessonContent {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  order: number;
  type: "text" | "video";
  content: string;
  videoYoutubeId: string | null;
  estimatedMinutes: number;
}

/** Full date in IST, e.g. "10 Nov 2026". */
export function formatFullDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

export function freePreviewLessons(course: CourseDetail) {
  return course.outline.modules.filter((m) => m.isFreePreview).flatMap((m) => m.lessons);
}
