import { cacheLife } from "next/cache";
import type { CourseCard } from "./catalog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

/**
 * Published programs for the landing page. Cached on the server for ~10 min
 * (brief §5.5: the page stays static and fast). If the API is unreachable we
 * return an empty list and the UI shows its honest empty state, never fake cards.
 */
export async function getPublishedCourses(): Promise<CourseCard[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  try {
    const res = await fetch(`${API_URL}/courses`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const body = (await res.json()) as { success: boolean; courses?: CourseCard[] };
    return body.success && Array.isArray(body.courses) ? body.courses : [];
  } catch {
    return [];
  }
}
