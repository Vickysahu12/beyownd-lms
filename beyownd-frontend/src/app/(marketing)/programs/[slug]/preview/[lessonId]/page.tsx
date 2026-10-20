import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon, Clock01Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";
import { Markdown, stripLeadingTitle } from "@/components/content/markdown";
import { YouTubeLite } from "@/components/content/youtube-lite";
import { PageHeader } from "@/components/marketing/page-header";
import { buttonVariants } from "@/components/ui/button";
import { freePreviewLessons } from "@/lib/catalog";
import { getCourse, getPreviewLesson } from "@/lib/catalog.server";
import { JsonLd, absolute, breadcrumbs, organization, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

/* PAGES.md §3.4: free preview lessons (Module 1). Indexable: real educational content. */

export async function generateStaticParams({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  const lessons = course ? freePreviewLessons(course) : [];
  return lessons.length ? lessons.map((l) => ({ lessonId: l.id })) : [{ lessonId: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/programs/[slug]/preview/[lessonId]">): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const [course, result] = await Promise.all([getCourse(slug), getPreviewLesson(slug, lessonId)]);
  if (!course || !result || "locked" in result) return { title: "Lesson preview", robots: { index: false, follow: true } };
  return {
    ...pageMetadata({
      title: `${result.lesson.title} · ${course.title}`,
      description: `Free lesson from Beyownd's ${course.title} virtual internship: ${result.lesson.title}. Read it free, no sign-up needed.`.slice(0, 158),
      path: `/programs/${slug}/preview/${lessonId}`,
    }),
    openGraph: { type: "article", title: result.lesson.title, url: `/programs/${slug}/preview/${lessonId}`, siteName: "Beyownd", locale: "en_IN" },
  };
}

export default function PreviewPage(props: PageProps<"/programs/[slug]/preview/[lessonId]">) {
  return (
    <Suspense fallback={<div aria-busy className="mx-auto min-h-[60dvh] max-w-[760px] px-4 pt-[148px]"><div className="h-12 w-2/3 animate-pulse rounded-xl bg-canvas" /></div>}>
      <Preview params={props.params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const [course, result] = await Promise.all([getCourse(slug), getPreviewLesson(slug, lessonId)]);
  if (!course || !result) notFound();

  const crumbs = [
    { name: "Programs", href: "/programs" },
    { name: course.title, href: `/programs/${slug}` },
    { name: "Free preview", href: `/programs/${slug}/preview/${lessonId}` },
  ];

  if ("locked" in result) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<>Enroll to <span className="text-brand">unlock</span></>} lead={`This lesson is part of the paid ${course.title} program. Module 1 is free to read.`}>
          <div className="flex flex-wrap gap-3">
            <Link href={`/programs/${slug}#batches`} className={buttonVariants({ size: "lg" })}>Pick a batch</Link>
            <Link href={`/programs/${slug}`} className={buttonVariants({ variant: "outline", size: "lg" })}>See the syllabus</Link>
          </div>
        </PageHeader>
      </>
    );
  }

  const { lesson } = result;
  const free = freePreviewLessons(course);
  const index = free.findIndex((l) => l.id === lesson.id);
  const prev = index > 0 ? free[index - 1] : null;
  const next = index >= 0 && index < free.length - 1 ? free[index + 1] : null;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "LearningResource",
            name: lesson.title,
            url: absolute(`/programs/${slug}/preview/${lesson.id}`),
            isAccessibleForFree: true,
            timeRequired: `PT${lesson.estimatedMinutes}M`,
            isPartOf: { "@type": "Course", name: course.title, url: absolute(`/programs/${slug}`), provider: organization },
          },
          breadcrumbs([{ name: "Home", path: "/" }, ...crumbs.map((c) => ({ name: c.name, path: c.href }))]),
        ]}
      />
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <article className="min-w-0">
          <PageHeader className="pb-8 lg:pb-10" crumbs={crumbs} title={lesson.title}>
            <p className="flex flex-wrap items-center gap-3 text-[14px] text-muted">
              <span className="rounded-md bg-mint px-2 py-0.5 text-[12px] font-medium text-success-ink">Free preview</span>
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={Clock01Icon} size={15} strokeWidth={1.7} aria-hidden />
                {lesson.estimatedMinutes} min
              </span>
              <span>
                Lesson {index + 1} of {free.length}
              </span>
            </p>
          </PageHeader>
          <div className="px-4 sm:px-6 lg:px-8">
            {lesson.type === "video" && lesson.videoYoutubeId ? (
              <div className="mb-8">
                <YouTubeLite id={lesson.videoYoutubeId} title={lesson.title} />
              </div>
            ) : null}
            <Markdown>{stripLeadingTitle(lesson.content, lesson.title)}</Markdown>

            <nav aria-label="Lesson navigation" className="mt-14 grid grid-cols-1 gap-3 border-t border-line pt-8 sm:grid-cols-2">
              {prev ? (
                <Link href={`/programs/${slug}/preview/${prev.id}`} className="lift group flex items-center gap-3 rounded-2xl p-4 ring-1 ring-line">
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={18} strokeWidth={1.8} aria-hidden className="transition-transform group-hover:-translate-x-1" />
                  <span className="min-w-0"><span className="block text-[12.5px] text-muted">Previous</span><span className="block truncate text-[15px] text-ink">{prev.title}</span></span>
                </Link>
              ) : <span />}
              {next ? (
                <Link href={`/programs/${slug}/preview/${next.id}`} className="lift group flex items-center justify-end gap-3 rounded-2xl p-4 text-right ring-1 ring-line">
                  <span className="min-w-0"><span className="block text-[12.5px] text-muted">Next</span><span className="block truncate text-[15px] text-ink">{next.title}</span></span>
                  <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="transition-transform group-hover:translate-x-1" />
                </Link>
              ) : null}
            </nav>
          </div>
        </article>

        <aside className="px-4 pb-20 sm:px-6 lg:px-0 lg:pt-[148px]">
          <div className="rounded-[24px] bg-ink p-6 text-white lg:sticky lg:top-28">
            <p className="text-[13px] text-white/60">{course.title}</p>
            <p className="mt-2 text-[24px] font-light leading-tight tracking-[-0.03em]">Enjoying it? The rest of the program is waiting.</p>
            <ul className="mt-4 space-y-1.5 text-[14px] text-white/75">
              <li className="flex items-center gap-2"><HugeiconsIcon icon={SquareLock01Icon} size={14} strokeWidth={1.8} aria-hidden />{course.outline.modules.length - 1} more modules with quizzes</li>
              <li className="flex items-center gap-2"><HugeiconsIcon icon={SquareLock01Icon} size={14} strokeWidth={1.8} aria-hidden />A mentor-reviewed final project</li>
              <li className="flex items-center gap-2"><HugeiconsIcon icon={SquareLock01Icon} size={14} strokeWidth={1.8} aria-hidden />Verifiable letters and certificate</li>
            </ul>
            <Link href={`/programs/${slug}#batches`} className={cn("group/btn mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15.5px] text-ink transition-transform active:scale-[0.97]")}>
              Enroll in a batch
              <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform group-hover/btn:translate-x-1" />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
