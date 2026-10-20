import { cacheLife, cacheTag } from "next/cache";
import type { CohortSummary, CourseCard, CourseDetail, LessonContent } from "./catalog";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

/*
 * Server-side catalog reads for the marketing pages (PAGES.md §2: ISR ~10 min).
 * Called from the server, so there's no CORS and no token. On any failure we
 * return an honest empty/null result and the page shows its empty state.
 */

async function getJson<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; code?: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(5000) });
    const body = (await res.json().catch(() => ({}))) as T & { success?: boolean; code?: string };
    if (!res.ok || body.success === false) return { ok: false, status: res.status, code: body.code };
    return { ok: true, data: body };
  } catch {
    return { ok: false, status: 503 };
  }
}

/** Published programs. */
export async function getPublishedCourses(): Promise<CourseCard[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  cacheTag("courses");
  const r = await getJson<{ courses: CourseCard[] }>("/courses");
  return r.ok && Array.isArray(r.data.courses) ? r.data.courses : [];
}

/** Program detail with its outline, or null when it doesn't exist. */
export async function getCourse(slug: string): Promise<CourseDetail | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  cacheTag(`course:${slug}`);
  const r = await getJson<{ course: CourseDetail }>(`/courses/${encodeURIComponent(slug)}`);
  return r.ok ? r.data.course : null;
}

/** Batches open for enrolment. */
export async function getCohorts(slug: string): Promise<CohortSummary[]> {
  "use cache";
  cacheLife({ stale: 120, revalidate: 300, expire: 3600 });
  cacheTag(`course:${slug}`);
  const r = await getJson<{ cohorts: CohortSummary[] }>(`/courses/${encodeURIComponent(slug)}/cohorts`);
  return r.ok && Array.isArray(r.data.cohorts) ? r.data.cohorts : [];
}

/** A free-preview lesson. `locked` when the API says PREVIEW_NOT_AVAILABLE. */
export async function getPreviewLesson(
  slug: string,
  lessonId: string,
): Promise<{ lesson: LessonContent } | { locked: true } | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  cacheTag(`course:${slug}`);
  const r = await getJson<{ lesson: LessonContent }>(
    `/courses/${encodeURIComponent(slug)}/preview/lessons/${encodeURIComponent(lessonId)}`,
  );
  if (r.ok) return { lesson: r.data.lesson };
  if (r.code === "PREVIEW_NOT_AVAILABLE") return { locked: true };
  return null;
}
