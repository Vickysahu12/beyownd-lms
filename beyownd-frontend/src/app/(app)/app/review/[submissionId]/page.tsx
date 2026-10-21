"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, Github01Icon, Link01Icon } from "@hugeicons/core-free-icons";
import { MarkdownClient } from "@/components/content/markdown-client";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { StatusPill } from "@/components/app/status-pill";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Field, Skeleton, TextArea, istDate } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { SubmissionDetail } from "@/lib/staff-types";
import { cn } from "@/lib/utils";

/*
 * One submission: links, notes, the brief, previous versions, and the rubric
 * form. The total % updates live; approving below the pass mark is blocked
 * in the UI (the API rejects it too with SCORE_BELOW_PASS).
 */
export default function ReviewDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const q = useQuery({ queryKey: ["submission", submissionId], queryFn: () => api<SubmissionDetail>(`/review/submissions/${submissionId}`) });

  return (
    <>
      <Link href={`${CLASSROOM_URL}/review`} className="mb-5 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden />
        Back to queue
      </Link>
      {q.isPending ? (
        <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>
      ) : q.isError ? (
        <ErrorState message={q.error instanceof ApiError && q.error.code === "NOT_FOUND" ? "This submission doesn't exist." : errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <Detail data={q.data} />
      )}
    </>
  );
}

function Detail({ data }: { data: SubmissionDetail }) {
  const { submission: s, student, project } = data;
  const reviewed = s.status !== "pending";
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="min-w-0 space-y-6">
        <Card className="p-6">
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            {project.courseTitle} · Version {s.version} · submitted {istDate(s.submittedAt, true)} <StatusPill status={s.status} />
          </p>
          <h1 className="mt-2 text-[28px] font-light tracking-[-0.03em] text-ink">{student.name}</h1>
          {student.college ? <p className="text-[14.5px] text-muted">{student.college}</p> : null}
          <div className="mt-5 grid gap-2">
            <a href={s.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 ring-1 ring-line hover:bg-canvas">
              <HugeiconsIcon icon={Github01Icon} size={17} strokeWidth={1.7} aria-hidden />
              <span className="truncate font-mono text-[13px] text-ink">{s.repoUrl}</span>
            </a>
            {s.liveUrl ? (
              <a href={s.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 ring-1 ring-line hover:bg-canvas">
                <HugeiconsIcon icon={Link01Icon} size={17} strokeWidth={1.7} aria-hidden />
                <span className="truncate font-mono text-[13px] text-ink">{s.liveUrl}</span>
              </a>
            ) : null}
          </div>
          {s.notes ? (
            <div className="mt-5">
              <p className="text-[13px] text-muted">Student&apos;s notes</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{s.notes}</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-[19px] tracking-[-0.02em] text-ink">Brief: {project.title}</h2>
          <div className="mt-3 max-h-[480px] overflow-y-auto pr-1">
            <MarkdownClient>{project.brief}</MarkdownClient>
          </div>
        </Card>

        {data.previousVersions.length ? (
          <Card className="p-6">
            <h2 className="text-[19px] tracking-[-0.02em] text-ink">Earlier versions</h2>
            <ol className="mt-4 space-y-4">
              {data.previousVersions.map((v) => (
                <li key={v.id} className="rounded-xl bg-canvas p-4">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink">
                    Version {v.version} <StatusPill status={v.status} />
                    <span className="text-muted">{istDate(v.submittedAt)}{v.totalPercent !== null ? ` · ${v.totalPercent}%` : ""}</span>
                  </p>
                  {v.feedback ? <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">{v.feedback}</p> : null}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        {reviewed && s.review ? <ReviewedCard data={data} /> : <DecisionForm data={data} />}
      </div>
    </div>
  );
}

function ReviewedCard({ data }: { data: SubmissionDetail }) {
  const r = data.submission.review!;
  return (
    <Card className="p-6">
      <h2 className="text-[19px] tracking-[-0.02em] text-ink">Review · {r.totalPercent}%</h2>
      <p className="text-[13px] text-muted">Decided {istDate(r.decidedAt, true)}</p>
      <ul className="mt-4 space-y-2">
        {r.rubricScores.map((sc) => {
          const max = data.project.rubric.find((x) => x.criterion === sc.criterion)?.maxScore;
          return (
            <li key={sc.criterion} className="flex justify-between rounded-lg bg-canvas px-3 py-2 text-[14px]">
              <span className="text-ink-soft">{sc.criterion}</span>
              <span className="font-mono text-ink">{sc.score}{max ? ` / ${max}` : ""}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">{r.feedback}</p>
    </Card>
  );
}

function DecisionForm({ data }: { data: SubmissionDetail }) {
  const { project, submission } = data;
  const toast = useToast();
  const qc = useQueryClient();
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(project.rubric.map((r) => [r.criterion, ""])));
  const [feedback, setFeedback] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const { total, complete, invalid } = useMemo(() => {
    let earned = 0;
    let max = 0;
    let complete = true;
    let invalid = false;
    for (const r of project.rubric) {
      const raw = scores[r.criterion];
      const n = Number(raw);
      max += r.maxScore;
      if (raw === "" || Number.isNaN(n)) complete = false;
      else if (n < 0 || n > r.maxScore) invalid = true;
      else earned += n;
    }
    return { total: max ? Math.round((earned / max) * 100) : 0, complete, invalid };
  }, [scores, project.rubric]);

  const feedbackOk = feedback.trim().length >= 10;
  const ready = complete && !invalid && feedbackOk;
  const canApprove = ready && total >= project.passScorePercent;

  const decide = useMutation({
    mutationFn: (decision: "approved" | "changes_requested") =>
      api<{ totalPercent: number; completion: string | null }>(`/review/submissions/${submission.id}/decision`, {
        method: "POST",
        body: { decision, feedback: feedback.trim(), rubricScores: project.rubric.map((r) => ({ criterion: r.criterion, score: Number(scores[r.criterion]) })) },
      }),
    onSuccess: (res, decision) => {
      toast("success", decision === "approved" ? `Approved at ${res.totalPercent}%. The student has been emailed.` : "Changes requested. The student has been emailed.");
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["submission", submission.id] });
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : "";
      setServerError(
        code === "SUBMISSION_ALREADY_REVIEWED" ? "Someone has already reviewed this submission. Refresh to see their decision."
          : code === "SCORE_BELOW_PASS" ? `The total is below the pass mark (${project.passScorePercent}%). Request changes instead.`
          : code === "RUBRIC_INVALID" ? "Scores don't match the rubric. Check each one is within its maximum."
          : errorMessage(e),
      );
      throw e;
    },
  });

  return (
    <Card className="p-6">
      <h2 className="text-[19px] tracking-[-0.02em] text-ink">Your review</h2>
      <p className="text-[13px] text-muted">Pass mark {project.passScorePercent}%. The student sees your scores and feedback.</p>
      <div className="mt-5 space-y-3">
        {project.rubric.map((r) => {
          const v = scores[r.criterion];
          const bad = v !== "" && (Number(v) < 0 || Number(v) > r.maxScore);
          return (
            <label key={r.criterion} className="flex items-center gap-3 rounded-xl bg-canvas px-3.5 py-2.5">
              <span className="flex-1 text-[14.5px] text-ink">{r.criterion}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={r.maxScore}
                value={v}
                onChange={(e) => setScores((s) => ({ ...s, [r.criterion]: e.target.value }))}
                aria-invalid={bad || undefined}
                aria-label={`${r.criterion} score out of ${r.maxScore}`}
                className="h-10 w-20 rounded-lg bg-white px-2 text-right font-mono text-[16px] text-ink outline-none ring-1 ring-line-strong focus:ring-2 focus:ring-brand aria-[invalid=true]:ring-st-stuck"
              />
              <span className="w-10 font-mono text-[13px] text-muted">/ {r.maxScore}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl px-1">
        <span className="text-[14px] text-ink-soft">Total</span>
        <span className={cn("font-mono text-[22px]", complete && !invalid ? (total >= project.passScorePercent ? "text-success-ink" : "text-[#a3263a]") : "text-muted")}>
          {complete && !invalid ? `${total}%` : "—"}
        </span>
      </div>
      <Field className="mt-3" label="Feedback for the student" error={feedback && !feedbackOk ? "At least 10 characters. Tell them what's good and what to improve." : undefined} hint="Be specific. If you request changes, say exactly what to fix.">
        {(id, d) => <TextArea id={id} aria-describedby={d} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={5000} className="min-h-36" />}
      </Field>
      {serverError ? <p role="alert" className="mb-3 rounded-xl bg-[#fde8eb] px-3.5 py-2.5 text-[14px] text-[#a3263a]">{serverError}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <ConfirmDialog
          trigger={<Button variant="outline" disabled={!ready}>Request changes</Button>}
          title="Request changes?"
          body="The student will be emailed your scores and feedback, and can submit a new version."
          confirmLabel="Request changes"
          danger={false}
          onConfirm={() => decide.mutateAsync("changes_requested")}
        />
        <ConfirmDialog
          trigger={<Button disabled={!canApprove}>Approve</Button>}
          title={`Approve at ${total}%?`}
          body="Approval can't be undone. If every module is done, the student's certificate will be issued after their batch ends."
          confirmLabel="Approve project"
          danger={false}
          onConfirm={() => decide.mutateAsync("approved")}
        />
      </div>
      {ready && !canApprove ? <p className="mt-2 text-[13px] text-[#a3263a]">Below the pass mark, so it can&apos;t be approved.</p> : null}
    </Card>
  );
}
