import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  BookOpen01Icon,
  Calendar03Icon,
  Certificate01Icon,
  CheckListIcon,
  Clock01Icon,
  File01Icon,
  FileValidationIcon,
  Github01Icon,
  InformationCircleIcon,
  MentoringIcon,
  SignalIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/marketing/page-header";
import { Syllabus } from "@/components/program/syllabus";
import { StickyEnroll } from "@/components/program/sticky-enroll";
import { InView } from "@/components/motion/in-view";
import { buttonVariants } from "@/components/ui/button";
import { coverFor, formatFullDate, formatRupees, freePreviewLessons, type CohortSummary, type CourseDetail } from "@/lib/catalog";
import { getCohorts, getCourse, getPublishedCourses } from "@/lib/catalog.server";
import { JsonLd, absolute, breadcrumbs, organization, pageMetadata } from "@/lib/seo";
import { enrollUrl, links } from "@/lib/site";
import { cn } from "@/lib/utils";

/*
 * PAGES.md §3.3: the main selling page. Prerendered for published programs,
 * refreshed through the cached catalog reads (~10 min); unknown slugs render
 * on demand. Params are awaited inside <Suspense> (Cache Components).
 */

export async function generateStaticParams() {
  const courses = await getPublishedCourses();
  // Cache Components needs at least one entry; the placeholder renders not-found.
  return courses.length ? courses.map((c) => ({ slug: c.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return { title: "Program not found", robots: { index: false, follow: true } };
  return pageMetadata({
    title: `${course.title} Virtual Internship`,
    description: (course.tagline ?? course.description).slice(0, 158),
    path: `/programs/${course.slug}`,
  });
}

export default function ProgramPage(props: PageProps<"/programs/[slug]">) {
  return (
    <Suspense fallback={<ProgramSkeleton />}>
      <Program params={props.params} />
    </Suspense>
  );
}

async function Program({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [course, cohorts] = await Promise.all([getCourse(slug), getCohorts(slug)]);
  if (!course) notFound();

  const prices = cohorts.map((c) => c.pricePaise);
  const fromPrice = prices.length ? formatRupees(Math.min(...prices)) : null;
  const preview = freePreviewLessons(course);
  const faqs = programFaqs(course);

  return (
    <>
      <JsonLd data={[courseJsonLd(course, cohorts), faqJsonLd(faqs), breadcrumbs([{ name: "Home", path: "/" }, { name: "Programs", path: "/programs" }, { name: course.title, path: `/programs/${course.slug}` }])]} />

      {/* 1. Hero */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <PageHeader
          className="pb-0 lg:pb-0"
          crumbs={[{ name: "Home", href: "/" }, { name: "Programs", href: "/programs" }, { name: course.title, href: `/programs/${course.slug}` }]}
          title={course.title}
          lead={course.tagline ?? undefined}
        >
          <ul className="flex flex-wrap gap-2" aria-label="Program facts">
            <Fact icon={Clock01Icon}>{course.durationWeeks} weeks</Fact>
            <Fact icon={SignalIcon}><span className="capitalize">{course.level}</span></Fact>
            <Fact icon={BookOpen01Icon}>{course.outline.totalLessons} lessons</Fact>
            {fromPrice ? <Fact icon={Certificate01Icon}>from {fromPrice}</Fact> : null}
          </ul>
          {course.skills.length ? (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
              {course.skills.map((s) => (
                <li key={s} className="rounded-md bg-brand-wash px-2.5 py-1 text-[13px] text-brand">{s}</li>
              ))}
            </ul>
          ) : null}
          <div id="program-cta" className="mt-8 flex flex-wrap gap-3">
            <a href="#batches" className={cn(buttonVariants({ size: "lg" }), "btn-shine")}>
              <span>Enroll in a batch</span>
              <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="-mr-1 transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
            </a>
            {preview[0] ? (
              <Link href={`/programs/${course.slug}/preview/${preview[0].id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Read Module 1 free
              </Link>
            ) : null}
          </div>
        </PageHeader>
        <div className="rise hidden px-8 lg:block" style={{ "--d": "200ms" } as React.CSSProperties}>
          <div className="rounded-[28px] bg-canvas p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG or remote cover in a fixed box */}
            <img src={coverFor(course)} alt="" width={480} height={300} className="aspect-[16/11] w-full rounded-[22px] object-cover" />
            <div className="grid grid-cols-3 gap-2 p-3 text-center">
              <Stat value={String(course.outline.modules.length)} label="Modules" />
              <Stat value={`${Math.round(course.outline.totalMinutes / 60)}h`} label="Of lessons" />
              <Stat value="1" label="Final project" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. What you'll do */}
      <InView as="section" className="mx-auto mt-20 max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="reveal display text-[34px] text-ink sm:text-[44px]">What you&apos;ll <span className="text-brand">do</span></h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen01Icon, t: "Learn module by module", d: `${course.outline.modules.length} modules of short lessons and videos.`, tint: "bg-sky-3 text-brand-navy" },
            { icon: CheckListIcon, t: "Pass each quiz", d: "Pass at 60% to unlock the next module. Retry after a minute.", tint: "bg-lavender text-[#5b3aa8]" },
            { icon: Github01Icon, t: "Build the project", d: `${course.project.title}. A mentor reviews it.`, tint: "bg-peach text-[#8a3b12]" },
            { icon: Certificate01Icon, t: "Get your documents", d: "Offer letter, certificate and completion letter, all verifiable.", tint: "bg-mint text-success-ink" },
          ].map((s, i) => (
            <li key={s.t} className="reveal lift group rounded-[24px] bg-white p-6 ring-1 ring-line" style={{ "--i": i + 1 } as React.CSSProperties}>
              <span className={cn("grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6", s.tint)}>
                <HugeiconsIcon icon={s.icon} size={22} strokeWidth={1.6} aria-hidden />
              </span>
              <h3 className="mt-5 text-[18px] tracking-[-0.02em] text-ink"><span className="mr-1.5 font-mono text-[13px] text-muted">0{i + 1}</span>{s.t}</h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </InView>

      {/* 3. Syllabus + 4. project */}
      <InView as="section" className="mx-auto mt-20 grid max-w-[1200px] grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="reveal display text-[34px] text-ink sm:text-[44px]">The <span className="text-brand">syllabus</span></h2>
          <p className="reveal mt-4 text-[16px] leading-[1.6] text-ink-soft" style={{ "--i": 1 } as React.CSSProperties}>
            {course.outline.modules.length} modules · {course.outline.totalLessons} lessons · about {Math.round(course.outline.totalMinutes / 60)} hours. Module 1 is free to read before you pay.
          </p>
          <div className="reveal mt-8 rounded-[24px] bg-ink p-6 text-white" style={{ "--i": 2 } as React.CSSProperties}>
            <p className="text-[13px] text-white/60">Final project</p>
            <h3 className="mt-1 text-[22px] font-light tracking-[-0.03em]">{course.project.title}</h3>
            <p className="mt-3 text-[14.5px] leading-[1.6] text-white/75">
              You build it yourself and submit your GitHub link. A mentor reviews it, then approves it or tells you what to improve.
            </p>
          </div>
        </div>
        <div className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
          <Syllabus slug={course.slug} modules={course.outline.modules} />
        </div>
      </InView>

      {/* 5. What you get */}
      <InView as="section" className="mx-auto mt-20 max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="reveal rounded-[32px] bg-canvas p-6 sm:p-10">
          <h2 className="display text-[34px] text-ink sm:text-[44px]">What you <span className="text-brand">get</span></h2>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: File01Icon, t: "Offer letter", d: "With your batch dates", tint: "bg-sky-3 text-brand-navy" },
              { icon: Certificate01Icon, t: "Certificate", d: "With a QR code", tint: "bg-butter text-[#6b5000]" },
              { icon: FileValidationIcon, t: "Completion letter", d: "For your college file", tint: "bg-mint text-success-ink" },
              { icon: MentoringIcon, t: "Mentor feedback", d: "On your project", tint: "bg-peach text-[#8a3b12]" },
              { icon: UserGroupIcon, t: "Batch community", d: "WhatsApp group", tint: "bg-lavender text-[#5b3aa8]" },
            ].map((g) => (
              <li key={g.t} className="lift group rounded-2xl bg-white p-5 ring-1 ring-line">
                <span className={cn("grid size-10 place-items-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5", g.tint)}>
                  <HugeiconsIcon icon={g.icon} size={19} strokeWidth={1.6} aria-hidden />
                </span>
                <p className="mt-4 text-[16px] text-ink">{g.t}</p>
                <p className="text-[13.5px] text-muted">{g.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </InView>

      {/* 6. Batches + 7. timing note */}
      <InView as="section" id="batches" className="mx-auto mt-20 max-w-[1200px] scroll-mt-24 px-4 sm:px-6 lg:px-8" aria-labelledby="batches-title">
        <h2 id="batches-title" className="reveal display text-[34px] text-ink sm:text-[44px]">Pick a <span className="text-brand">batch</span></h2>
        <p className="reveal mt-3 text-[16px] text-ink-soft" style={{ "--i": 1 } as React.CSSProperties}>
          Dates are in IST. The dates of your batch are the dates printed on your letters.
        </p>
        {cohorts.length === 0 ? (
          <div className="reveal mt-8 flex flex-col items-start gap-4 rounded-[24px] bg-white p-6 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between" style={{ "--i": 2 } as React.CSSProperties}>
            <p className="text-[16px] text-ink">No batch is open right now. Create a free account and we&apos;ll tell you when the next one opens.</p>
            <Link href={links.signup} className={buttonVariants({ size: "md" })}>Notify me</Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cohorts.map((c, i) => (
              <li key={c.id} className="reveal" style={{ "--i": i + 2 } as React.CSSProperties}>
                <BatchCard slug={course.slug} cohort={c} />
              </li>
            ))}
          </ul>
        )}
        <p className="reveal mt-6 flex items-start gap-2.5 rounded-2xl bg-butter px-4 py-3.5 text-[14.5px] leading-snug text-[#5c4700]" style={{ "--i": 3 } as React.CSSProperties}>
          <HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.7} aria-hidden className="mt-px shrink-0" />
          Documents are issued after your batch ends and your project is approved.
        </p>
      </InView>

      {/* 8. FAQ + final CTA */}
      <section aria-labelledby="program-faq" className="mx-auto mt-20 max-w-[1200px] px-4 pb-24 sm:px-6 lg:px-8">
        <h2 id="program-faq" className="display text-[34px] text-ink sm:text-[44px]">Questions about this <span className="text-brand">program</span></h2>
        <dl className="mt-8 grid gap-6 md:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.q} className="border-t border-line pt-5">
              <dt className="text-[17px] tracking-[-0.02em] text-ink">{f.q}</dt>
              <dd className="mt-2 text-[15px] leading-[1.6] text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-14 flex flex-col items-start gap-5 rounded-[28px] bg-ink p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <p className="text-[26px] font-light leading-tight tracking-[-0.03em] sm:text-[32px]">Ready to start {course.title}?</p>
          <a href="#batches" className="group/btn inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 text-[16px] text-ink transition-transform duration-150 active:scale-[0.97]">
            Pick a batch
            <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/btn:translate-x-1" />
          </a>
        </div>
      </section>

      <StickyEnroll price={fromPrice} />
    </>
  );
}

function Fact({ icon, children }: { icon: IconSvgElement; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[14px] text-ink-soft">
      <HugeiconsIcon icon={icon} size={15} strokeWidth={1.7} aria-hidden />
      {children}
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white py-3">
      <p className="text-[24px] font-light tracking-[-0.03em] text-ink">{value}</p>
      <p className="text-[12px] text-muted">{label}</p>
    </div>
  );
}

function BatchCard({ slug, cohort: c }: { slug: string; cohort: CohortSummary }) {
  const full = c.seatsLeft <= 0;
  const low = !full && c.seatsLeft <= 10;
  const state = c.enrollable ? "open" : full ? "full" : "closed";
  return (
    <div className={cn("flex h-full flex-col rounded-[24px] bg-white p-6 ring-1 ring-line", c.enrollable && "lift")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[18px] tracking-[-0.02em] text-ink">{c.name}</p>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[12px] font-medium",
            state === "open" ? "bg-st-done text-white" : state === "full" ? "bg-st-stuck text-white" : "bg-[#c4c7d0] text-white",
          )}
        >
          {state === "open" ? "Open" : state === "full" ? "Full" : "Closed"}
        </span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[14.5px] text-ink-soft">
        <HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={1.7} aria-hidden />
        {formatFullDate(c.startDate)} to {formatFullDate(c.endDate)}
      </p>
      {low ? <p className="mt-1.5 text-[13.5px] text-[#a1512b]">Only {c.seatsLeft} seats left</p> : null}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <p className="text-[30px] font-light leading-none tracking-[-0.04em] text-ink">{formatRupees(c.pricePaise)}</p>
        {c.enrollable ? (
          <Link href={enrollUrl(slug, c.id)} className={buttonVariants({ size: "md" })}>
            <span>Enroll</span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
          </Link>
        ) : (
          <span aria-disabled className={cn(buttonVariants({ variant: "glass", size: "md" }), "pointer-events-none opacity-60")}>
            {full ? "Batch full" : "Enrolment closed"}
          </span>
        )}
      </div>
    </div>
  );
}

function ProgramSkeleton() {
  return (
    <div aria-busy className="mx-auto max-w-[1200px] px-4 pb-24 pt-[148px] sm:px-6 lg:px-8">
      <div className="h-4 w-48 animate-pulse rounded bg-canvas" />
      <div className="mt-6 h-16 w-3/4 animate-pulse rounded-xl bg-canvas" />
      <div className="mt-4 h-6 w-1/2 animate-pulse rounded bg-canvas" />
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-[24px] bg-canvas" />)}
      </div>
    </div>
  );
}

/* ---------- Content + structured data (only what's true; no ratings) ---------- */

function programFaqs(course: CourseDetail) {
  return [
    { q: "Do I need prior experience?", a: `No. ${course.title} is ${course.level === "beginner" ? "beginner-friendly" : `marked ${course.level}`}, and Module 1 is free to read before you pay.` },
    { q: "How long does it take?", a: `${course.durationWeeks} weeks, inside your batch's dates. Lessons are short and work on a phone.` },
    { q: "When do I get the certificate?", a: "After your batch end date, once every module is complete and a mentor has approved your project." },
    { q: "Will my college accept it?", a: "Every document can be verified online with its ID or QR code. Requirements differ, so please check with your college or TPO." },
  ];
}

function courseJsonLd(course: CourseDetail, cohorts: CohortSummary[]) {
  const min = cohorts.length ? Math.min(...cohorts.map((c) => c.pricePaise)) / 100 : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.tagline ?? course.description,
    url: absolute(`/programs/${course.slug}`),
    provider: organization,
    educationalLevel: course.level,
    ...(min !== undefined ? { offers: { "@type": "Offer", price: min, priceCurrency: "INR", category: "Paid", url: absolute(`/programs/${course.slug}#batches`) } } : {}),
    hasCourseInstance: cohorts.map((c) => ({
      "@type": "CourseInstance",
      name: c.name,
      courseMode: "online",
      startDate: c.startDate,
      endDate: c.endDate,
      offers: { "@type": "Offer", price: c.pricePaise / 100, priceCurrency: "INR" },
    })),
  };
}

function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
