import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, Calendar03Icon, Clock01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { coverFor, formatBatchDate, formatRupees } from "@/lib/catalog";
import { getPublishedCourses } from "@/lib/catalog.server";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Section } from "./section";

/* 5.5 Programs: real published courses from GET /api/courses (cached ~10 min). No fake cards. */
export async function Programs() {
  const courses = await getPublishedCourses();

  return (
    <Section id="programs" labelledBy="programs-title" tone="panel">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="programs-title"
          title={<>Pick your <span className="text-brand">program</span></>}
          sub="Project-based, mentor-reviewed, and run in batches with real dates."
        />
        <Link href={links.signup} className="reveal group/link inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[16px] text-ink" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="link-grow">Module 1 is free to preview</span>
          <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/link:translate-x-[3px]" />
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="reveal board group/empty mt-12 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8" style={{ "--i": 3 } as React.CSSProperties}>
          <span className="bell grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-wash text-brand">
            <HugeiconsIcon icon={Notification01Icon} size={24} strokeWidth={1.6} aria-hidden />
          </span>
          <div className="flex-1">
            <h3 className="text-[20px] tracking-[-0.02em] text-ink">New batches are being announced</h3>
            <p className="mt-1 text-[15px] text-muted">Create a free account and we will tell you when the next batch opens.</p>
          </div>
          <Link href={links.signup} className={cn(buttonVariants({ size: "md" }))}>
            <span>Get notified</span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
          </Link>
        </div>
      ) : (
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <li key={c.id} className="reveal" style={{ "--i": i + 3 } as React.CSSProperties}>
              <Link href={`/programs/${c.slug}`} className="lift group/card flex h-full flex-col rounded-[24px] bg-white p-2 ring-1 ring-line">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-sky-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- SVG or remote thumbnail in a fixed box */}
                  <img src={coverFor(c)} alt="" width={480} height={300} loading="lazy" className="size-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04]" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-[20px] tracking-[-0.02em] text-ink">{c.title}</h3>
                  {c.tagline ? <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-snug text-muted">{c.tagline}</p> : null}
                  {c.skills.length ? (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {c.skills.slice(0, 4).map((s) => (
                        <li key={s} className="rounded-md bg-canvas px-2 py-1 text-[12px] text-ink-soft">{s}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div className="space-y-1 text-[12.5px] text-muted">
                      <p className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.8} aria-hidden />
                        {c.durationWeeks} weeks
                      </p>
                      <p className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Calendar03Icon} size={14} strokeWidth={1.8} aria-hidden />
                        {c.nextCohortStartDate ? `Next batch ${formatBatchDate(c.nextCohortStartDate)}` : "Dates coming soon"}
                      </p>
                    </div>
                    <p className="text-right">
                      <span className="block text-[11.5px] text-muted">from</span>
                      <span className="text-[24px] font-light leading-none tracking-[-0.03em] text-ink">{formatRupees(c.fromPricePaise)}</span>
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
