import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, Calendar03Icon, Clock01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { coverFor, formatBatchDate, formatRupees, type CourseCard } from "@/lib/catalog";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";

/* One program card, used on the landing and on /programs. */
export function ProgramCard({ course: c, headingLevel = "h3" }: { course: CourseCard; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <Link href={`/programs/${c.slug}`} className="lift group/card flex h-full flex-col rounded-[24px] bg-white p-2 ring-1 ring-line">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-sky-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG or remote thumbnail in a fixed box */}
        <img src={coverFor(c)} alt="" width={480} height={300} loading="lazy" className="size-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04]" />
        <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[11.5px] capitalize text-ink-soft backdrop-blur">{c.level}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <H className="text-[20px] tracking-[-0.02em] text-ink">{c.title}</H>
        {c.tagline ? <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-snug text-muted">{c.tagline}</p> : null}
        {c.skills.length ? (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
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
        <span className="mt-4 inline-flex items-center gap-1.5 border-t border-line pt-3 text-[14px] text-brand">
          View program
          <HugeiconsIcon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/card:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

/* Honest empty state when no program is published yet. */
export function ProgramsEmpty({ title = "New batches are being announced" }: { title?: string }) {
  return (
    <div className="board group/empty flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
      <span className="bell grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-wash text-brand">
        <HugeiconsIcon icon={Notification01Icon} size={24} strokeWidth={1.6} aria-hidden />
      </span>
      <div className="flex-1">
        <p className="text-[20px] tracking-[-0.02em] text-ink">{title}</p>
        <p className="mt-1 text-[15px] text-muted">Create a free account and we will tell you when the next batch opens.</p>
      </div>
      <Link href={links.signup} className={cn(buttonVariants({ size: "md" }))}>
        <span>Get notified</span>
        <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
      </Link>
    </div>
  );
}
