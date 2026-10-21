"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon, ArrowRight01Icon, Calendar03Icon, CheckmarkCircle02Icon, CircleIcon, LockIcon, PlayCircleIcon, Quiz02Icon, TextIcon, WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { Card, ErrorState, PageTitle, Pill, Progress, Skeleton, istDate } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL, enrollUrl } from "@/lib/site";
import type { EnrollmentDashboard, ModuleState } from "@/lib/student-types";
import { cn } from "@/lib/utils";

/* Program dashboard: modules (locked / open / done), progress, batch banner, project, documents timing. */
export default function LearnPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const q = useQuery({ queryKey: ["enrollment", enrollmentId], queryFn: () => api<{ enrollment: EnrollmentDashboard }>(`/enrollments/${enrollmentId}`) });

  if (q.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError) return <ErrorState message={q.error instanceof ApiError && q.error.status === 404 ? "We couldn't find this program in your account." : errorMessage(q.error)} onRetry={() => q.refetch()} />;

  const d = q.data.enrollment;
  const base = `${CLASSROOM_URL}/learn/${d.id}`;
  const accessible = d.status === "active" || d.status === "completed";
  const nextLesson = d.modules.find((m) => m.unlocked && !m.completed)?.lessons.find((l) => !l.completed);
  const allDone = d.modules.length > 0 && d.modules.every((m) => m.completed);

  return (
    <>
      <PageTitle
        title={d.course?.title ?? "Program"}
        sub={`${d.cohort.name} · ${istDate(d.cohort.startDate)} – ${istDate(d.cohort.endDate)}`}
        actions={
          accessible && d.cohort.started && nextLesson ? (
            <Link href={`${base}/lessons/${nextLesson.id}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">
              {d.percentComplete > 0 ? "Continue" : "Start"}: {nextLesson.title}
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden />
            </Link>
          ) : null
        }
      />

      {d.status === "pending_payment" && d.course ? (
        <Banner tone="warn">
          Your payment isn&apos;t complete yet. <Link href={enrollUrl(d.course.slug, d.cohort.id)} className="underline">Complete payment</Link> to unlock the program.
        </Banner>
      ) : d.status === "refunded" || d.status === "cancelled" ? (
        <Banner tone="bad">This enrollment was {d.status}. Lessons are no longer available.</Banner>
      ) : !d.cohort.started ? (
        <Banner tone="info" icon={Calendar03Icon}>
          Your batch starts on <b className="font-medium">{istDate(d.cohort.startDate)}</b>. Free preview lessons are open now; the rest unlock on the start date.
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="modules-h">
          <h2 id="modules-h" className="sr-only">Modules</h2>
          <ol className="grid gap-3">
            {d.modules.map((m, i) => (
              <ModuleCard key={m.id} m={m} index={i} base={base} canOpen={accessible && (d.cohort.started || m.isFreePreview)} defaultOpen={m.unlocked && !m.completed} />
            ))}
          </ol>
        </section>

        <aside className="grid h-fit gap-4">
          <Card className="p-5">
            <div className="mb-2 flex justify-between text-[14px]"><span className="text-ink-soft">Your progress</span><span className="tabular-nums text-ink">{d.percentComplete}%</span></div>
            <Progress value={d.percentComplete} label="Program progress" />
            <p className="mt-3 text-[13px] text-muted">
              {d.modules.filter((m) => m.completed).length} of {d.modules.length} modules done
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-[13px] text-muted">Final project</p>
            <p className="mt-0.5 text-[15.5px] leading-snug text-ink">{d.course?.projectTitle ?? "Project"}</p>
            <div className="mt-2"><ProjectPill status={d.projectStatus} locked={!allDone} /></div>
            {accessible ? (
              <Link href={`${base}/project`} className="link-grow mt-3 inline-block text-[14px] text-brand">
                {allDone ? (d.projectStatus === "not_submitted" ? "Submit your project" : "View project") : "See the brief"}
              </Link>
            ) : null}
          </Card>

          <Card className="p-5">
            <p className="text-[13px] text-muted">Certificate</p>
            {d.completion.completed ? (
              <p className="mt-1 text-[14px] leading-snug text-ink-soft">
                {d.completion.documentsIssued
                  ? "Your certificate and completion letter are ready."
                  : `You've finished the program. Your certificate and completion letter will be issued on ${istDate(d.completion.documentsAvailableFrom)}, when the batch ends.`}{" "}
                <Link href={`${CLASSROOM_URL}/documents`} className="underline">Documents</Link>
              </p>
            ) : (
              <p className="mt-1 text-[14px] leading-snug text-ink-soft">Finish all modules and get your project approved. Documents are issued after the batch ends on {istDate(d.cohort.endDate)}.</p>
            )}
          </Card>

          {d.cohort.communityLink ? (
            <a href={d.cohort.communityLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[20px] bg-white p-5 ring-1 ring-line transition-colors hover:bg-[#fafbfc]">
              <span className="grid size-10 place-items-center rounded-xl bg-mint text-success-ink"><HugeiconsIcon icon={WhatsappIcon} size={20} strokeWidth={1.6} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] text-ink">Batch community</span>
                <span className="block text-[12.5px] text-muted">Join the WhatsApp group for updates</span>
              </span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden className="text-muted" />
            </a>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Banner({ tone, icon, children }: { tone: "warn" | "bad" | "info"; icon?: typeof Calendar03Icon; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("mb-5 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[14.5px] leading-snug", tone === "warn" && "bg-butter text-[#5c4700]", tone === "bad" && "bg-[#fde8eb] text-[#a3263a]", tone === "info" && "bg-brand-wash text-[#1f3a9e]")}>
      {icon ? <HugeiconsIcon icon={icon} size={18} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0" /> : null}
      <p>{children}</p>
    </div>
  );
}

function ProjectPill({ status, locked }: { status: EnrollmentDashboard["projectStatus"]; locked: boolean }) {
  if (status === "approved") return <Pill tone="good">Approved</Pill>;
  if (status === "pending_review") return <Pill tone="warn">In review</Pill>;
  if (status === "changes_requested") return <Pill tone="bad">Changes requested</Pill>;
  return locked ? <Pill>Unlocks after all modules</Pill> : <Pill tone="info">Ready to submit</Pill>;
}

function ModuleCard({ m, index, base, canOpen, defaultOpen }: { m: ModuleState; index: number; base: string; canOpen: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const locked = !m.unlocked || !canOpen;
  const quizReady = m.hasQuiz && m.lessonsCompleted === m.lessonsTotal;
  const panel = `module-${m.id}`;

  return (
    <li>
      <Card className={cn("overflow-hidden", locked && "bg-[#fbfbfc]")}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panel} className="flex w-full items-center gap-3.5 px-5 py-4 text-left">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-[14px] font-medium", m.completed ? "bg-mint text-success-ink" : locked ? "bg-canvas text-muted" : "bg-brand-wash text-brand")}>
            {m.completed ? <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} strokeWidth={1.8} aria-hidden /> : locked ? <HugeiconsIcon icon={LockIcon} size={17} strokeWidth={1.8} aria-hidden /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn("text-[16px] leading-snug tracking-[-0.01em]", locked ? "text-ink-soft" : "text-ink")}>{m.title}</span>
              {m.isFreePreview ? <Pill tone="info">Free preview</Pill> : null}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-muted">
              {m.completed ? "Completed" : !m.unlocked ? "Finish the previous module to unlock" : !canOpen ? "Unlocks when your batch starts" : `${m.lessonsCompleted} of ${m.lessonsTotal} lessons${m.hasQuiz ? " · quiz" : ""}`}
            </span>
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={18} strokeWidth={1.8} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
        </button>
        {open ? (
          <div id={panel} className="border-t border-line">
            <ul className="divide-y divide-line">
              {m.lessons.map((l) => {
                const row = (
                  <>
                    <HugeiconsIcon icon={l.completed ? CheckmarkCircle02Icon : CircleIcon} size={18} strokeWidth={1.7} aria-hidden className={cn("shrink-0", l.completed ? "text-success-ink" : "text-line-strong")} />
                    <span className={cn("min-w-0 flex-1 truncate text-[14.5px]", locked ? "text-muted" : "text-ink")}>{l.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-muted">
                      <HugeiconsIcon icon={l.type === "video" ? PlayCircleIcon : TextIcon} size={14} strokeWidth={1.7} aria-hidden />
                      {l.estimatedMinutes} min
                    </span>
                    <span className="sr-only">{l.completed ? "(done)" : ""}</span>
                  </>
                );
                return (
                  <li key={l.id}>
                    {locked ? (
                      <div className="flex items-center gap-3 px-5 py-3">{row}</div>
                    ) : (
                      <Link href={`${base}/lessons/${l.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#fafbfc]">{row}</Link>
                    )}
                  </li>
                );
              })}
              {m.hasQuiz ? (
                <li>
                  {!locked && quizReady ? (
                    <Link href={`${base}/modules/${m.id}/quiz`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#fafbfc]">
                      <HugeiconsIcon icon={m.quizPassed ? CheckmarkCircle02Icon : Quiz02Icon} size={18} strokeWidth={1.7} aria-hidden className={m.quizPassed ? "text-success-ink" : "text-brand"} />
                      <span className="flex-1 text-[14.5px] text-ink">Module quiz</span>
                      {m.quizPassed ? <Pill tone="good">Passed</Pill> : <Pill tone="info">Take quiz</Pill>}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3 text-muted">
                      <HugeiconsIcon icon={Quiz02Icon} size={18} strokeWidth={1.7} aria-hidden />
                      <span className="flex-1 text-[14.5px]">Module quiz</span>
                      <span className="text-[12.5px]">After all lessons</span>
                    </div>
                  )}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </Card>
    </li>
  );
}
