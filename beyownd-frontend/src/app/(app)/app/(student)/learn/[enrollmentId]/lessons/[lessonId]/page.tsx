"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowLeft02Icon, ArrowRight01Icon, CheckmarkCircle02Icon, SquareUnlock02Icon } from "@hugeicons/core-free-icons";
import { MarkdownClient } from "@/components/content/markdown-client";
import { YouTubeLite } from "@/components/content/youtube-lite";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Skeleton } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { CompletionResult, EnrollmentDashboard, StudentLesson } from "@/lib/student-types";

/*
 * Lesson player: markdown (sanitized) + lite YouTube, "Mark complete",
 * prev/next. When a module unlocks, a short (< 1 s) moment says so.
 */
const lockedCopy: Record<string, string> = {
  MODULE_LOCKED: "This lesson is in a module that's still locked. Finish the previous module first.",
  COHORT_NOT_STARTED: "Your batch hasn't started yet. This lesson opens on the start date.",
  ENROLLMENT_NOT_ACTIVE: "This enrollment isn't active, so lessons aren't available.",
};

export default function LessonPage() {
  const { enrollmentId, lessonId } = useParams<{ enrollmentId: string; lessonId: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const base = `${CLASSROOM_URL}/learn/${enrollmentId}`;
  const q = useQuery({ queryKey: ["lesson", enrollmentId, lessonId], queryFn: () => api<{ lesson: StudentLesson }>(`/enrollments/${enrollmentId}/lessons/${lessonId}`) });
  const dash = useQuery({ queryKey: ["enrollment", enrollmentId], queryFn: () => api<{ enrollment: EnrollmentDashboard }>(`/enrollments/${enrollmentId}`) });
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState<CompletionResult["nextModuleUnlocked"]>(null);

  const back = (
    <Link href={base} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
      <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> {dash.data?.enrollment.course?.title ?? "Program"}
    </Link>
  );

  if (q.isPending) return <div className="mx-auto grid max-w-[760px] gap-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-10 w-96 max-w-full" /><Skeleton className="h-96" /></div>;
  if (q.isError) {
    const code = q.error instanceof ApiError ? q.error.code : "";
    return (
      <div className="mx-auto max-w-[760px]">
        {back}
        <ErrorState message={lockedCopy[code] ?? (q.error instanceof ApiError && q.error.status === 404 ? "We couldn't find this lesson." : errorMessage(q.error))} onRetry={lockedCopy[code] ? undefined : () => q.refetch()} />
      </div>
    );
  }

  const l = q.data.lesson;
  const mod = dash.data?.enrollment.modules.find((m) => m.id === l.moduleId);
  const lessonsDone = mod ? mod.lessons.every((x) => x.completed || x.id === l.id) : false;
  const quizNext = !!mod && mod.hasQuiz && !mod.quizPassed && l.completed && lessonsDone;
  const nextIsOtherModule = !!mod && !!l.nextLessonId && !mod.lessons.some((x) => x.id === l.nextLessonId);

  const complete = async () => {
    setBusy(true);
    try {
      const r = await api<CompletionResult>(`/enrollments/${enrollmentId}/lessons/${lessonId}/complete`, { method: "POST" });
      qc.setQueryData<{ lesson: StudentLesson }>(["lesson", enrollmentId, lessonId], (old) => (old ? { lesson: { ...old.lesson, completed: true } } : old));
      qc.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      if (r.nextModuleUnlocked) setUnlocked(r.nextModuleUnlocked);
      else toast("success", `Lesson done · ${r.percentComplete}% of the program`);
    } catch (e) {
      toast("error", lockedCopy[e instanceof ApiError ? e.code : ""] ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="mx-auto max-w-[760px]">
      {back}
      <p className="text-[13px] text-muted">{mod ? `Module ${mod.order} · ${mod.title}` : " "}</p>
      <h1 className="mt-1 text-[28px] font-light leading-tight tracking-[-0.03em] text-ink sm:text-[34px]">{l.title}</h1>
      <p className="mt-1 text-[13px] text-muted">{l.estimatedMinutes} min {l.type === "video" ? "video" : "read"}</p>

      {l.videoYoutubeId ? <div className="mt-6"><YouTubeLite id={l.videoYoutubeId} title={l.title} /></div> : null}
      <Card className="mt-6 p-5 sm:p-8">
        <MarkdownClient>{l.content}</MarkdownClient>
      </Card>

      {unlocked ? (
        <div role="status" className="unlock-pop mt-6 flex items-center gap-3.5 rounded-[20px] bg-mint p-5 ring-1 ring-[#9fe3bf]">
          <span className="unlock-icon grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-success-ink">
            <HugeiconsIcon icon={SquareUnlock02Icon} size={22} strokeWidth={1.7} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] text-ink">Module complete. <b className="font-medium">{unlocked.title}</b> is unlocked.</p>
            <p className="text-[13px] text-success-ink">Nice work, keep the streak going.</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {l.completed ? (
          <p className="inline-flex items-center gap-2 text-[15px] text-success-ink"><HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} strokeWidth={1.8} aria-hidden /> Completed</p>
        ) : (
          <Button onClick={complete} loading={busy} className="w-full sm:w-auto">Mark as complete</Button>
        )}
        {quizNext ? (
          <Link href={`${base}/modules/${l.moduleId}/quiz`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">
            Take the module quiz <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden />
          </Link>
        ) : null}
      </div>

      <nav aria-label="Lessons" className="mt-8 grid grid-cols-2 gap-3 border-t border-line pt-5">
        {l.previousLessonId ? (
          <Link href={`${base}/lessons/${l.previousLessonId}`} className="inline-flex min-h-11 items-center gap-1.5 text-[14.5px] text-ink-soft hover:text-ink">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} aria-hidden /> Previous
          </Link>
        ) : <span />}
        {l.nextLessonId && !(nextIsOtherModule && quizNext) ? (
          <Link href={`${base}/lessons/${l.nextLessonId}`} className="inline-flex min-h-11 items-center justify-end gap-1.5 text-right text-[14.5px] text-brand">
            Next lesson <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden />
          </Link>
        ) : (
          <Link href={base} className="inline-flex min-h-11 items-center justify-end text-[14.5px] text-ink-soft hover:text-ink">Back to program</Link>
        )}
      </nav>
    </article>
  );
}
