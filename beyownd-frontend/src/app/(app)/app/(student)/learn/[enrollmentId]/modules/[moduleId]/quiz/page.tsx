"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, Cancel01Icon, CheckmarkCircle02Icon, SquareUnlock02Icon } from "@hugeicons/core-free-icons";
import { MarkdownClient } from "@/components/content/markdown-client";
import { FormError } from "@/components/app/auth-shell";
import { Button, Card, ErrorState, Pill, Progress, Skeleton, istDate } from "@/components/app/ui";
import { useCountdown } from "@/components/app/use-countdown";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { EnrollmentDashboard, QuizAttemptRow, QuizResult, StudentQuiz } from "@/lib/student-types";
import { cn } from "@/lib/utils";

/*
 * Module quiz (BRIEF §10.2 #8). One question per screen. Fail → only
 * right/wrong per question + the cooldown countdown (details.retryAfterSeconds).
 * Pass → correct answers and explanations, and the next module unlocks.
 */
export default function QuizPage() {
  const { enrollmentId, moduleId } = useParams<{ enrollmentId: string; moduleId: string }>();
  const qc = useQueryClient();
  const base = `${CLASSROOM_URL}/learn/${enrollmentId}`;
  const key = ["quiz", enrollmentId, moduleId];
  const quiz = useQuery({ queryKey: key, queryFn: () => api<{ quiz: StudentQuiz }>(`/enrollments/${enrollmentId}/modules/${moduleId}/quiz`), staleTime: 0 });
  const attempts = useQuery({ queryKey: [...key, "attempts"], queryFn: () => api<{ attempts: QuizAttemptRow[] }>(`/enrollments/${enrollmentId}/modules/${moduleId}/quiz/attempts`), enabled: quiz.isSuccess });
  const dash = useQuery({ queryKey: ["enrollment", enrollmentId], queryFn: () => api<{ enrollment: EnrollmentDashboard }>(`/enrollments/${enrollmentId}`) });
  const mod = dash.data?.enrollment.modules.find((m) => m.id === moduleId);

  const [phase, setPhase] = useState<"intro" | "taking" | "result">("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, startCooldown] = useCountdown(0);
  // The cooldown from GET only matters until the student starts their own countdown.
  const [seeded, setSeeded] = useState(false);
  if (quiz.data && !seeded) {
    setSeeded(true);
    if (quiz.data.quiz.retryAfterSeconds > 0) startCooldown(quiz.data.quiz.retryAfterSeconds);
  }

  const back = (
    <Link href={base} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
      <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> Back to program
    </Link>
  );

  if (quiz.isPending) return <div className="mx-auto grid max-w-[680px] gap-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-72" /></div>;
  if (quiz.isError) {
    const code = quiz.error instanceof ApiError ? quiz.error.code : "";
    const msg =
      code === "LESSONS_INCOMPLETE" ? "Finish all the lessons in this module first, then take the quiz." :
      code === "MODULE_LOCKED" ? "This module is still locked. Finish the previous module first." :
      code === "COHORT_NOT_STARTED" ? "Your batch hasn't started yet." : errorMessage(quiz.error);
    return <div className="mx-auto max-w-[680px]">{back}<ErrorState message={msg} onRetry={code ? undefined : () => quiz.refetch()} /></div>;
  }

  const qz = quiz.data.quiz;
  const qs = qz.questions;
  const current = qs[index];
  const picked = answers[current?.id] ?? [];
  const title = mod ? `${mod.title}: quiz` : "Module quiz";

  const toggle = (qid: string, i: number, single: boolean) =>
    setAnswers((a) => {
      const cur = a[qid] ?? [];
      return { ...a, [qid]: single ? [i] : cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort() };
    });

  const start = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setError(null);
    setPhase("taking");
  };

  const retry = async () => {
    // New attempt gets a freshly shuffled set.
    await quiz.refetch();
    start();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<QuizResult>(`/enrollments/${enrollmentId}/modules/${moduleId}/quiz/attempts`, {
        method: "POST",
        body: { answers: qs.map((q) => ({ questionId: q.id, selectedOptionIndexes: answers[q.id] ?? [] })) },
      });
      setResult(r);
      setPhase("result");
      if (!r.passed) startCooldown(r.retryAfterSeconds);
      qc.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      qc.invalidateQueries({ queryKey: [...key, "attempts"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "QUIZ_COOLDOWN") {
        startCooldown(Number(e.details.retryAfterSeconds) || 60);
        setError("You can try again when the timer ends.");
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-[680px]">
        {back}
        <h1 className="text-[28px] font-light tracking-[-0.03em] text-ink sm:text-[34px]">{title}</h1>
        <Card className="mt-5 p-6">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-canvas p-3"><dt className="text-[12.5px] text-muted">Questions</dt><dd className="mt-0.5 text-[20px] text-ink">{qz.totalQuestions}</dd></div>
            <div className="rounded-2xl bg-canvas p-3"><dt className="text-[12.5px] text-muted">Pass mark</dt><dd className="mt-0.5 text-[20px] text-ink">{qz.passPercent}%</dd></div>
            <div className="rounded-2xl bg-canvas p-3"><dt className="text-[12.5px] text-muted">Your best</dt><dd className="mt-0.5 text-[20px] text-ink">{qz.bestScorePercent}%</dd></div>
          </dl>
          {qz.passed ? (
            <p className="mt-5 flex items-center gap-2 text-[15px] text-success-ink"><HugeiconsIcon icon={CheckmarkCircle02Icon} size={19} strokeWidth={1.8} aria-hidden /> You&apos;ve passed this quiz. You can take it again for practice.</p>
          ) : (
            <p className="mt-5 text-[14.5px] text-ink-soft">Questions come in a new order each time. If you don&apos;t pass, you&apos;ll see which ones were wrong and can try again after a short wait.</p>
          )}
          <Button onClick={start} disabled={left > 0} className="mt-5 w-full sm:w-auto">
            {left > 0 ? <span className="tabular-nums">Try again in {left}s</span> : qz.passed ? "Practice again" : attempts.data?.attempts.length ? "Try again" : "Start quiz"}
          </Button>
        </Card>
        {attempts.data?.attempts.length ? (
          <Card className="mt-4 overflow-hidden">
            <h2 className="px-5 pb-2 pt-4 text-[15px] text-ink">Your attempts</h2>
            <ul className="divide-y divide-line border-t border-line text-[14px]">
              {attempts.data.attempts.slice(0, 5).map((a) => (
                <li key={a.attemptNumber} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-muted">#{a.attemptNumber}</span>
                  <span className="flex-1 text-muted">{istDate(a.createdAt, true)}</span>
                  <span className="tabular-nums text-ink">{a.scorePercent}%</span>
                  {a.passed ? <Pill tone="good">Passed</Pill> : <Pill>Not passed</Pill>}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    );
  }

  if (phase === "result" && result) {
    const byId = Object.fromEntries(result.results.map((r) => [r.questionId, r]));
    return (
      <div className="mx-auto max-w-[680px]">
        {back}
        <Card className={cn("p-6", result.passed ? "bg-mint ring-[#9fe3bf]" : "")}>
          <div role="status">
            <p className={cn("text-[14px]", result.passed ? "text-success-ink" : "text-muted")}>{result.passed ? "Passed" : "Not passed this time"}</p>
            <p className="mt-1 text-[44px] font-light leading-none tracking-[-0.04em] text-ink tabular-nums">{result.scorePercent}%</p>
            <p className="mt-2 text-[14px] text-ink-soft">Pass mark {result.passPercent}% · {result.results.filter((r) => r.correct).length} of {result.results.length} correct</p>
          </div>
        </Card>

        {result.nextModuleUnlocked ? (
          <div role="status" className="unlock-pop mt-4 flex items-center gap-3.5 rounded-[20px] bg-white p-5 ring-1 ring-line">
            <span className="unlock-icon grid size-11 shrink-0 place-items-center rounded-2xl bg-mint text-success-ink"><HugeiconsIcon icon={SquareUnlock02Icon} size={22} strokeWidth={1.7} aria-hidden /></span>
            <p className="flex-1 text-[15px] text-ink"><b className="font-medium">{result.nextModuleUnlocked.title}</b> is unlocked.</p>
            <Link href={base} className="text-[14px] text-brand">Open</Link>
          </div>
        ) : null}

        <ol className="mt-5 grid gap-3">
          {qs.map((q, i) => {
            const r = byId[q.id];
            return (
              <li key={q.id}>
                <Card className="p-5">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", r?.correct ? "bg-mint text-success-ink" : "bg-[#fde8eb] text-[#a3263a]")}>
                      <HugeiconsIcon icon={r?.correct ? CheckmarkCircle02Icon : Cancel01Icon} size={16} strokeWidth={2} aria-hidden />
                      <span className="sr-only">{r?.correct ? "Correct" : "Wrong"}</span>
                    </span>
                    <div className="min-w-0 flex-1 text-[15px]">
                      <p className="text-[12.5px] text-muted">Question {i + 1}</p>
                      <div className="quiz-prompt"><MarkdownClient>{q.prompt}</MarkdownClient></div>
                      {result.passed && r?.correctOptionIndexes ? (
                        <>
                          <ul className="mt-2 grid gap-1.5">
                            {q.options.map((o, k) => {
                              const right = r.correctOptionIndexes!.includes(k);
                              const mine = (answers[q.id] ?? []).includes(k);
                              return (
                                <li key={k} className={cn("rounded-xl px-3 py-2 text-[14px]", right ? "bg-mint text-success-ink" : mine ? "bg-[#fde8eb] text-[#a3263a]" : "text-ink-soft")}>
                                  {o}
                                  {right ? <span className="sr-only"> (correct answer)</span> : mine ? <span className="sr-only"> (your answer)</span> : null}
                                </li>
                              );
                            })}
                          </ul>
                          {r.explanation ? <p className="mt-2 text-[13.5px] leading-snug text-muted">{r.explanation}</p> : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {result.passed ? (
            <Link href={base} className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">Continue the program</Link>
          ) : (
            <Button onClick={retry} disabled={left > 0} className="w-full sm:w-auto">
              {left > 0 ? <span className="tabular-nums">Try again in {left}s</span> : "Try again"}
            </Button>
          )}
          {!result.passed ? <Link href={base} className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] text-ink-soft hover:bg-canvas">Review the lessons</Link> : null}
        </div>
      </div>
    );
  }

  // Taking the quiz
  const answeredAll = qs.every((q) => (answers[q.id] ?? []).length > 0);
  const last = index === qs.length - 1;
  return (
    <div className="mx-auto max-w-[680px]">
      {back}
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span>{title}</span>
        <span className="tabular-nums" aria-live="polite">Question {index + 1} of {qs.length}</span>
      </div>
      <Progress value={((index + 1) / qs.length) * 100} label="Quiz progress" className="mt-2" />

      <Card className="mt-5 p-5 sm:p-7">
        <fieldset key={current.id} className="dialog-pop" data-state="open">
          <legend className="sr-only">Question {index + 1}</legend>
          <div className="quiz-prompt text-[17px] text-ink"><MarkdownClient>{current.prompt}</MarkdownClient></div>
          <p className="mt-1 text-[13px] text-muted">{current.type === "multiple" ? "Pick all that apply" : "Pick one"}</p>
          <div className="mt-4 grid gap-2">
            {current.options.map((o, i) => {
              const on = picked.includes(i);
              return (
                <label key={i} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-[15px] ring-1 transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand", on ? "bg-brand-wash text-ink ring-brand" : "bg-white text-ink-soft ring-line-strong hover:bg-canvas")}>
                  <input
                    type={current.type === "multiple" ? "checkbox" : "radio"}
                    name={current.id}
                    checked={on}
                    onChange={() => toggle(current.id, i, current.type !== "multiple")}
                    className="size-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="min-w-0 break-words">{o}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <div className="mt-4">
        <FormError>{error}</FormError>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (index === 0 ? setPhase("intro") : setIndex((i) => i - 1))}>{index === 0 ? "Cancel" : "Back"}</Button>
        {last ? (
          <Button onClick={submit} loading={busy} disabled={!answeredAll || left > 0}>
            {left > 0 ? <span className="tabular-nums">Wait {left}s</span> : "Submit answers"}
          </Button>
        ) : (
          <Button onClick={() => setIndex((i) => i + 1)} disabled={!picked.length}>Next</Button>
        )}
      </div>
      {last && !answeredAll ? <p className="mt-3 text-right text-[13px] text-muted">Answer every question to submit.</p> : null}
    </div>
  );
}
