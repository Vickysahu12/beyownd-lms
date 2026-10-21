"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { MarkdownField } from "@/components/app/admin/markdown-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Field, PageTitle, Select, Skeleton, TextInput } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { AdminLesson } from "@/lib/staff-types";

/* Pulls the 11-character ID out of a pasted YouTube URL. */
function youtubeId(input: string) {
  const s = input.trim();
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : s;
}

export default function LessonEditorPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const q = useQuery({ queryKey: ["admin-lesson", lessonId], queryFn: () => api<{ lesson: AdminLesson }>(`/admin/lessons/${lessonId}`) });
  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96" /></div>;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <Editor lesson={q.data.lesson} />;
}

function Editor({ lesson }: { lesson: AdminLesson }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const initial = { title: lesson.title, type: lesson.type, content: lesson.content ?? "", video: lesson.videoYoutubeId ?? "", minutes: String(lesson.estimatedMinutes ?? 10) };
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const back = `${CLASSROOM_URL}/admin/courses/${lesson.courseId}`;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api(`/admin/lessons/${lesson._id}`, {
        method: "PATCH",
        body: {
          title: f.title.trim(),
          type: f.type,
          content: f.content,
          videoYoutubeId: f.type === "video" && f.video ? youtubeId(f.video) : null,
          estimatedMinutes: Number(f.minutes),
        },
      });
      setSaved(f);
      qc.invalidateQueries({ queryKey: ["admin-course", lesson.courseId] });
      toast("success", "Lesson saved.");
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) setErrors(e.fieldErrors());
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href={back} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> Back to course
      </Link>
      <PageTitle
        title={f.title || "Untitled lesson"}
        sub={dirty ? "Unsaved changes" : "All changes saved"}
        actions={
          <>
            <ConfirmDialog
              trigger={<Button variant="ghost">Delete</Button>}
              title="Delete this lesson?"
              body="Students who already completed it keep their progress. This can't be undone."
              confirmLabel="Delete lesson"
              onConfirm={async () => {
                await api(`/admin/lessons/${lesson._id}`, { method: "DELETE" });
                qc.invalidateQueries({ queryKey: ["admin-course", lesson.courseId] });
                router.push(back);
              }}
            />
            <Button onClick={save} loading={busy} disabled={!dirty}>Save</Button>
          </>
        }
      />
      <Card className="grid gap-1 p-6">
        <div className="grid gap-x-4 sm:grid-cols-[1fr_140px_140px]">
          <Field label="Title" error={errors.title}>{(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!errors.title} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
          <Field label="Type">{(id) => <Select id={id} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "text" | "video" })}><option value="text">Text</option><option value="video">Video</option></Select>}</Field>
          <Field label="Minutes" error={errors.estimatedMinutes}>{(id, d) => <TextInput id={id} aria-describedby={d} type="number" min={1} max={120} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />}</Field>
        </div>
        {f.type === "video" ? (
          <Field label="YouTube video (link or 11-character ID)" error={errors.videoYoutubeId} hint={f.video ? `Video ID: ${youtubeId(f.video)}` : "Paste the youtube.com or youtu.be link"}>
            {(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!errors.videoYoutubeId} value={f.video} onChange={(e) => setF({ ...f, video: e.target.value })} />}
          </Field>
        ) : null}
        <MarkdownField label="Lesson content (Markdown)" value={f.content} onChange={(v) => setF({ ...f, content: v })} error={errors.content} rows={22} />
        {formError ? <p role="alert" className="mt-2 rounded-xl bg-[#fde8eb] px-4 py-3 text-[14px] text-[#a3263a]">{formError}</p> : null}
      </Card>
    </>
  );
}
