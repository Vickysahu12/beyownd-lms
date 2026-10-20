import type { MetadataRoute } from "next";
import { freePreviewLessons } from "@/lib/catalog";
import { getCourse, getPublishedCourses } from "@/lib/catalog.server";
import { SITE_URL } from "@/lib/site";

/* Every indexable marketing URL. Excludes /verify/* (personal data) and the whole app. */
const staticPages = ["/", "/programs", "/for-colleges", "/verify", "/about", "/faq", "/contact", "/terms", "/privacy", "/refund-policy", "/delivery-policy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await getPublishedCourses();
  const details = await Promise.all(courses.map((c) => getCourse(c.slug)));

  const programUrls = courses.flatMap((c, i) => {
    const d = details[i];
    const lessons = d ? freePreviewLessons(d) : [];
    return [
      { url: `${SITE_URL}/programs/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.9 },
      ...lessons.map((l) => ({ url: `${SITE_URL}/programs/${c.slug}/preview/${l.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ];
  });

  return [
    ...staticPages.map((p) => ({
      url: `${SITE_URL}${p === "/" ? "" : p}`,
      changeFrequency: (p === "/" || p === "/programs" ? "weekly" : "monthly") as "weekly" | "monthly",
      priority: p === "/" ? 1 : p === "/programs" ? 0.9 : 0.5,
    })),
    ...programUrls,
  ];
}
