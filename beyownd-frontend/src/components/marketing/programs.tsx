import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublishedCourses } from "@/lib/catalog.server";
import { links } from "@/lib/site";
import { Section } from "./section";
import { ProgramCard, ProgramsEmpty } from "./program-card";

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
        <div className="reveal mt-12" style={{ "--i": 3 } as React.CSSProperties}>
          <ProgramsEmpty />
        </div>
      ) : (
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <li key={c.id} className="reveal" style={{ "--i": i + 3 } as React.CSSProperties}>
              <ProgramCard course={c} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
