"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowLeft02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Field, PageTitle, Select, Skeleton, TextArea, TextInput } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/api";
import type { AdminQuiz, QuizQuestion } from "@/lib/staff-types";
import { cn } from "@/lib/utils";

/* Quiz editor for one module. Admin view includes the correct answers. */
type Quiz = AdminQuiz & { courseId?: string };

const blank = (): QuizQuestion => ({ prompt: "", type: "single", options: ["", ""], correctOptionIndexes: [0], explanation: "" });

function problems(pass: number, qs: QuizQuestion[]) {
  const out: string[] = [];
  if (qs.length < 3 || qs.length > 30) out.push("A quiz needs 3-30 questions.");
  if (pass < 1 || pass > 100) out.push("Pass mark must be 1-100%.");
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!q.prompt.trim()) out.push(`Question ${n} has no text.`);
    if (q.options.some((o) => !o.trim())) out.push(`Question ${n} has an empty option.`);
    if (!q.correctOptionIndexes.length) out.push(`Question ${n} has no correct answer.`);
    if (q.type === "single" && q.correctOptionIndexes.length !== 1) out.push(`Question ${n} is single choice, so pick exactly one answer.`);
  });
  return out;
}

export default function QuizEditorPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const q = useQuery({ queryKey: ["admin-quiz", moduleId], queryFn: () => api<{ quiz: Quiz | null }>(`/admin/modules/${moduleId}/quiz`) });
  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96" /></div>;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <Editor moduleId={moduleId} quiz={q.data.quiz} />;
}

function Editor({ moduleId, quiz }: { moduleId: string; quiz: Quiz | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [pass, setPass] = useState(String(quiz?.passPercent ?? 60));
  const [qs, setQs] = useState<QuizQuestion[]>(() =>
    quiz?.questions?.length
      ? quiz.questions.map((x) => ({ prompt: x.prompt, type: x.type ?? "single", options: [...x.options], correctOptionIndexes: [...x.correctOptionIndexes], explanation: x.explanation ?? "" }))
      : [blank(), blank(), blank()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = problems(Number(pass), qs);

  const update = (i: number, patch: Partial<QuizQuestion>) => setQs((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleCorrect = (i: number, o: number) => {
    const q = qs[i];
    if (q.type === "single") return update(i, { correctOptionIndexes: [o] });
    const has = q.correctOptionIndexes.includes(o);
    update(i, { correctOptionIndexes: has ? q.correctOptionIndexes.filter((x) => x !== o) : [...q.correctOptionIndexes, o].sort() });
  };
  const removeOption = (i: number, o: number) => {
    const q = qs[i];
    update(i, {
      options: q.options.filter((_, k) => k !== o),
      correctOptionIndexes: q.correctOptionIndexes.filter((x) => x !== o).map((x) => (x > o ? x - 1 : x)),
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/modules/${moduleId}/quiz`, {
        method: "PUT",
        body: { passPercent: Number(pass), questions: qs.map((x) => ({ ...x, prompt: x.prompt.trim(), options: x.options.map((o) => o.trim()), explanation: x.explanation?.trim() || undefined })) },
      });
      qc.invalidateQueries({ queryKey: ["admin-quiz", moduleId] });
      if (quiz?.courseId) qc.invalidateQueries({ queryKey: ["admin-course", quiz.courseId] });
      toast("success", "Quiz saved. Students see the new questions on their next attempt.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => router.back()} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> Back
      </button>
      <PageTitle
        title={quiz ? "Edit quiz" : "New quiz"}
        sub="Questions are shuffled for students. They see answers and explanations only after passing."
        actions={
          <>
            {quiz ? (
              <ConfirmDialog
                trigger={<Button variant="ghost">Delete quiz</Button>}
                title="Delete this quiz?"
                body="The module will no longer need a quiz to be completed."
                confirmLabel="Delete quiz"
                onConfirm={async () => {
                  await api(`/admin/modules/${moduleId}/quiz`, { method: "DELETE" });
                  qc.invalidateQueries({ queryKey: ["admin-quiz", moduleId] });
                  router.back();
                }}
              />
            ) : null}
            <Button onClick={save} loading={busy} disabled={issues.length > 0}>Save quiz</Button>
          </>
        }
      />

      <Card className="mb-4 p-5">
        <Field label="Pass mark (%)" className="max-w-[180px]">{(id) => <TextInput id={id} type="number" min={1} max={100} value={pass} onChange={(e) => setPass(e.target.value)} />}</Field>
      </Card>

      <ol className="grid gap-4">
        {qs.map((q, i) => (
          <li key={i}>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] text-ink">Question {i + 1}</p>
                <div className="flex items-center gap-2">
                  <Select aria-label={`Question ${i + 1} type`} value={q.type} onChange={(e) => update(i, { type: e.target.value as "single" | "multiple", correctOptionIndexes: q.correctOptionIndexes.slice(0, 1) })} className="h-9 w-[170px] text-[14px]">
                    <option value="single">Single choice</option>
                    <option value="multiple">Multiple choice</option>
                  </Select>
                  <button type="button" aria-label={`Remove question ${i + 1}`} disabled={qs.length <= 3} onClick={() => setQs((all) => all.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-[#a3263a] disabled:opacity-30">
                    <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.7} aria-hidden />
                  </button>
                </div>
              </div>
              <TextArea aria-label={`Question ${i + 1} text`} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} className="mt-3 min-h-20" placeholder="Question text (Markdown allowed)" />
              <fieldset className="mt-3">
                <legend className="text-[13px] text-muted">Options. Tick the {q.type === "single" ? "correct answer" : "correct answers"}.</legend>
                <ul className="mt-2 grid gap-2">
                  {q.options.map((o, k) => {
                    const correct = q.correctOptionIndexes.includes(k);
                    return (
                      <li key={k} className={cn("flex items-center gap-2 rounded-xl p-1.5 pl-3 ring-1", correct ? "bg-mint/60 ring-[#9fe3bf]" : "ring-line")}>
                        <input
                          type={q.type === "single" ? "radio" : "checkbox"}
                          name={`q${i}`}
                          checked={correct}
                          onChange={() => toggleCorrect(i, k)}
                          aria-label={`Option ${k + 1} is correct`}
                          className="size-4 shrink-0 accent-[var(--success)]"
                        />
                        <input value={o} onChange={(e) => update(i, { options: q.options.map((x, z) => (z === k ? e.target.value : x)) })} aria-label={`Option ${k + 1}`} className="h-9 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none sm:text-[15px]" placeholder={`Option ${k + 1}`} />
                        <button type="button" aria-label={`Remove option ${k + 1}`} disabled={q.options.length <= 2} onClick={() => removeOption(i, k)} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas disabled:opacity-30">
                          <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.7} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={q.options.length >= 6} onClick={() => update(i, { options: [...q.options, ""] })}>
                  <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.8} aria-hidden /> Add option
                </Button>
              </fieldset>
              <TextInput aria-label={`Explanation for question ${i + 1}`} value={q.explanation ?? ""} onChange={(e) => update(i, { explanation: e.target.value })} className="mt-3" placeholder="Explanation (shown after passing)" />
            </Card>
          </li>
        ))}
      </ol>
      <Button variant="outline" className="mt-4" disabled={qs.length >= 30} onClick={() => setQs((all) => [...all, blank()])}>
        <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} aria-hidden /> Add question
      </Button>

      {issues.length ? (
        <div role="status" className="mt-5 rounded-xl bg-butter px-4 py-3 text-[14px] text-[#5c4700]">
          <p className="font-medium">Fix these before saving:</p>
          <ul className="mt-1 list-disc pl-5">{issues.slice(0, 6).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-[#fde8eb] px-4 py-3 text-[14px] text-[#a3263a]">{error}</p> : null}
    </>
  );
}
