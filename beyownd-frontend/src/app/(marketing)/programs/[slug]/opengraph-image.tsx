import { ImageResponse } from "next/og";
import { OgCard, ogSize } from "@/components/og/og-card";
import { getCourse, getPublishedCourses } from "@/lib/catalog.server";

export const alt = "Beyownd virtual internship program";
export const size = ogSize;
export const contentType = "image/png";

export async function generateStaticParams() {
  const courses = await getPublishedCourses();
  return courses.length ? courses.map((c) => ({ slug: c.slug })) : [{ slug: "_" }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  return new ImageResponse(
    <OgCard
      eyebrow="Virtual internship program"
      title={course?.title ?? "Beyownd programs"}
      footer={course ? `${course.durationWeeks} weeks · Mentor-reviewed project · Verifiable certificate` : "Verifiable certificate"}
    />,
    size,
  );
}
