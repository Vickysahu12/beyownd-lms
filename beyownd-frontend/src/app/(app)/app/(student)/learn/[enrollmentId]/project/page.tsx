"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, GithubIcon, LockIcon } from "@hugeicons/core-free-icons";
import { MarkdownClient } from "@/components/content/markdown-client";
import { FormError } from "@/components/app/auth-shell";
import { StatusPill } from "@/components/app/status-pill";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Field, Skeleton, TextArea, TextInput, istDate } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { MySubmission, ProjectView } from "@/lib/student-types";
import { cn } from "@/lib/utils";

/*
 * Final project: brief + rubric, locked until every module is done. Submit a
 * GitHub repo (+ optional live link, notes); then a timeline of submissions
 * with the mentor's scores and feedback.
 */
const GITHUB = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}(\/.*)?$/;

export default function ProjectPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const base = `${CLASSROOM_URL}/learn/${enrollmentId}`;
  const key = ["project", enrollmentId];
  const q = useQuery({ queryKey: key, queryFn: () => api<ProjectView>(`/enrollments/${enrollmentId}/project`) });
  const [f, setF] = useState({ repoUrl: "", liveUrl: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = (
    <Link href={base} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
      <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> Back to program
    </Link>
  );

  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-80" /></div>;
  if (q.isError) return <>{back}<ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></>;
  const p = q.data;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!GITHUB.test(f.repoUrl.trim())) local.repoUrl = "Enter a GitHub repository link like https://github.com/you/project";
    if (f.liveUrl.trim() && !/^https:\/\/\S+\.\S+/.test(f.liveUrl.trim())) local.liveUrl = "Live link must start with https://";
    if (f.notes.length > 2000) local.notes = "Notes can be at most 2000 characters";
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await api(`/enrollments/${enrollmentId}/project/submissions`, {
        method: "POST",
        body: { repoUrl: f.repoUrl.trim(), liveUrl: f.liveUrl.trim() || undefined, notes: f.notes.trim() || undefined },
      });
      setF({ repoUrl: "", liveUrl: "", notes: "" });
      toast("success", "Project submitted. A mentor will review it.");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      if (code === "SUBMISSION_PENDING") setError("Your previous submission is still being reviewed. You can submit again if the mentor asks for changes.");
      else if (code === "MODULES_INCOMPLETE") setError("Finish every module before submitting the project.");
      else if (code === "PROJECT_ALREADY_APPROVED") setError("Your project is already approved.");
      else if (code !== "VALIDATION_ERROR") setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const latest = p.submissions[0];

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-light tracking-[-0.03em] text-ink sm:text-[34px]">{p.project.title}</h1>
        {latest ? <StatusPill status={latest.status} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid h-fit gap-5">
          <Card className="p-5 sm:p-7">
            <MarkdownClient>{p.project.brief}</MarkdownClient>
          </Card>

          {!p.unlocked ? (
            <Card className="flex items-start gap-3 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-muted"><HugeiconsIcon icon={LockIcon} size={18} strokeWidth={1.7} aria-hidden /></span>
              <p className="text-[14.5px] leading-snug text-ink-soft">You can submit once every module is complete. Read the brief now so you can plan ahead.</p>
            </Card>
          ) : p.canSubmit ? (
            <Card className="p-5 sm:p-7">
              <h2 className="text-[19px] tracking-[-0.02em] text-ink">{p.projectStatus === "changes_requested" ? "Submit an updated version" : "Submit your project"}</h2>
              <form onSubmit={submit} noValidate className="mt-4">
                <Field label="GitHub repository" error={errors.repoUrl} hint="Must be public so the mentor can open it">
                  {(id, d) => (
                    <div className="relative">
                      <HugeiconsIcon icon={GithubIcon} size={17} strokeWidth={1.7} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                      <TextInput id={id} aria-describedby={d} type="url" inputMode="url" placeholder="https://github.com/you/project" value={f.repoUrl} invalid={!!errors.repoUrl} onChange={(e) => setF((x) => ({ ...x, repoUrl: e.target.value }))} className="pl-10" />
                    </div>
                  )}
                </Field>
                <Field label="Live link (optional)" error={errors.liveUrl} hint="Vercel, Netlify, GitHub Pages…">
                  {(id, d) => <TextInput id={id} aria-describedby={d} type="url" inputMode="url" placeholder="https://" value={f.liveUrl} invalid={!!errors.liveUrl} onChange={(e) => setF((x) => ({ ...x, liveUrl: e.target.value }))} />}
                </Field>
                <Field label="Notes for the mentor (optional)" error={errors.notes} hint={`${f.notes.length}/2000`}>
                  {(id, d) => <TextArea id={id} aria-describedby={d} value={f.notes} maxLength={2000} invalid={!!errors.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} placeholder="What you built, anything you'd like feedback on" />}
                </Field>
                <FormError>{error}</FormError>
                <Button type="submit" loading={busy} className="w-full sm:w-auto">Submit for review</Button>
              </form>
            </Card>
          ) : p.projectStatus === "pending_review" ? (
            <Card className="p-5 text-[14.5px] leading-snug text-ink-soft">Your project is with a mentor. You&apos;ll get an email when it&apos;s reviewed; feedback shows up below.</Card>
          ) : p.projectStatus === "approved" ? (
            <Card className="bg-mint p-5 text-[14.5px] leading-snug text-success-ink ring-[#9fe3bf]">Approved. Your certificate and completion letter are issued after the batch ends.</Card>
          ) : null}

          {p.submissions.length ? (
            <section aria-labelledby="history-h">
              <h2 id="history-h" className="mb-3 text-[19px] tracking-[-0.02em] text-ink">Submissions</h2>
              <ol className="relative grid gap-4 border-l border-line pl-5">
                {p.submissions.map((s) => <SubmissionItem key={s.id} s={s} rubric={p.project.rubric} />)}
              </ol>
            </section>
          ) : null}
        </div>

        <Card className="h-fit p-5 lg:sticky lg:top-6">
          <h2 className="text-[15px] text-ink">How it&apos;s marked</h2>
          <ul className="mt-3 grid gap-2 text-[14px]">
            {p.project.rubric.map((r) => (
              <li key={r.criterion} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
                <span className="text-ink-soft">{r.criterion}</span>
                <span className="shrink-0 tabular-nums text-muted">{r.maxScore} pts</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">You need {p.project.passScorePercent}% to pass. If changes are requested, fix them and submit again.</p>
        </Card>
      </div>
    </>
  );
}

function SubmissionItem({ s, rubric }: { s: MySubmission; rubric: ProjectView["project"]["rubric"] }) {
  const max = Object.fromEntries(rubric.map((r) => [r.criterion, r.maxScore]));
  return (
    <li className="relative">
      <span aria-hidden className={cn("absolute -left-[27px] top-5 size-3 rounded-full ring-4 ring-canvas", s.status === "approved" ? "bg-success" : s.status === "changes_requested" ? "bg-st-stuck" : "bg-st-progress")} />
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] text-ink">Version {s.version}</span>
          <StatusPill status={s.status} />
          <span className="text-[12.5px] text-muted">{istDate(s.submittedAt, true)}</span>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
          <a href={s.repoUrl} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline-offset-2 hover:underline">{s.repoUrl.replace("https://github.com/", "github.com/")}</a>
          {s.liveUrl ? <a href={s.liveUrl} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline-offset-2 hover:underline">Live site</a> : null}
        </p>
        {s.review ? (
          <div className="mt-4 rounded-2xl bg-canvas p-4">
            <p className="text-[13px] text-muted">Mentor review · {s.review.totalPercent}%</p>
            <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{s.review.feedback}</p>
            <ul className="mt-3 grid gap-1 text-[13px]">
              {s.review.rubricScores.map((r) => (
                <li key={r.criterion} className="flex justify-between gap-3"><span className="text-ink-soft">{r.criterion}</span><span className="tabular-nums text-muted">{r.score}{max[r.criterion] ? ` / ${max[r.criterion]}` : ""}</span></li>
              ))}
            </ul>
          </div>
        ) : s.status === "pending" ? (
          <p className="mt-3 text-[13.5px] text-muted">Waiting for a mentor.</p>
        ) : null}
      </Card>
    </li>
  );
}
