"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowLeft02Icon, CheckListIcon, Delete02Icon, FileEditIcon, PencilEdit01Icon, PlayIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { CourseForm } from "@/components/app/admin/course-form";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ReorderList } from "@/components/app/reorder-list";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Field, PageTitle, Pill, Select, Skeleton, TextInput } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { AdminModule, CourseStructure } from "@/lib/staff-types";
import { cn } from "@/lib/utils";

/* Course editor: details, status, modules (reorder), lessons (reorder), quiz links. */
export default function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["admin-course", courseId];
  const q = useQuery({ queryKey: key, queryFn: () => api<CourseStructure>(`/admin/courses/${courseId}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-64" /></div>;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const { course, modules, hasStudents } = q.data;

  const setStatus = async (status: "draft" | "published" | "archived") => {
    await api(`/admin/courses/${courseId}`, { method: "PATCH", body: { status } });
    toast("success", status === "published" ? "Published. It's live on the website within a few minutes." : status === "archived" ? "Archived. It's hidden from the website." : "Moved back to draft.");
    refresh();
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  return (
    <>
      <Link href={`${CLASSROOM_URL}/admin/courses`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> All courses
      </Link>
      <PageTitle
        title={course.title}
        sub={`/programs/${course.slug}${hasStudents ? " · has students (deleting modules is blocked)" : ""}`}
        actions={
          <>
            <Pill tone={course.status === "published" ? "good" : course.status === "draft" ? "warn" : "neutral"}>{course.status}</Pill>
            {course.status === "published" ? (
              <a href={`/programs/${course.slug}`} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14.5px] text-ink-soft ring-1 ring-line-strong hover:bg-white">
                <HugeiconsIcon icon={ViewIcon} size={16} strokeWidth={1.7} aria-hidden /> View
              </a>
            ) : null}
            {course.status !== "published" ? (
              <ConfirmDialog trigger={<Button>Publish</Button>} title="Publish this course?" body="It will appear on the website and students can enroll in its open batches." confirmLabel="Publish" danger={false} onConfirm={() => setStatus("published")} />
            ) : (
              <ConfirmDialog trigger={<Button variant="outline">Archive</Button>} title="Archive this course?" body="It disappears from the website. Enrolled students keep their access." confirmLabel="Archive" onConfirm={() => setStatus("archived")} />
            )}
            {course.status === "archived" ? <Button variant="ghost" onClick={() => setStatus("draft").catch((e) => toast("error", errorMessage(e)))}>Move to draft</Button> : null}
          </>
        }
      />

      <Modules courseId={courseId} modules={modules} refresh={refresh} />

      <details className="group mt-8">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[18px] tracking-[-0.02em] text-ink">
          <HugeiconsIcon icon={PencilEdit01Icon} size={18} strokeWidth={1.7} aria-hidden /> Course details and final project
          <span className="text-[13px] text-muted group-open:hidden">(click to edit)</span>
        </summary>
        <div className="mt-4">
          <CourseForm
            initial={course}
            submitLabel="Save changes"
            onSubmit={async (p) => {
              await api(`/admin/courses/${courseId}`, { method: "PATCH", body: p });
              toast("success", "Saved.");
              refresh();
              qc.invalidateQueries({ queryKey: ["admin-courses"] });
            }}
          />
        </div>
      </details>
    </>
  );
}

function Modules({ courseId, modules, refresh }: { courseId: string; modules: AdminModule[]; refresh: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/courses/${courseId}/modules`, { method: "POST", body: { title: title.trim() } });
      setTitle("");
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[18px] tracking-[-0.02em] text-ink">Modules</h2>
        <p className="text-[13px] text-muted">Drag or use the arrows to reorder</p>
      </div>
      {modules.length ? (
        <div className="border-t border-line">
          <ReorderList
            label="module"
            items={modules}
            onReorder={(ids) =>
              api(`/admin/courses/${courseId}/modules/order`, { method: "PUT", body: { moduleIds: ids } }).then(refresh, (e) => {
                toast("error", errorMessage(e));
                refresh();
                throw e;
              })
            }
            render={(m, i) => <ModuleRow module={m} index={i} refresh={refresh} />}
          />
        </div>
      ) : (
        <p className="border-t border-line px-5 py-6 text-[14.5px] text-muted">No modules yet. Add the first one below.</p>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 border-t border-line bg-canvas px-5 py-4 sm:flex-row">
        <TextInput aria-label="New module title" placeholder="New module title (3-100 characters)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" loading={busy} disabled={title.trim().length < 3}>
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} aria-hidden /> Add module
        </Button>
      </form>
      {error ? <p role="alert" className="px-5 pb-4 text-[13.5px] text-[#a3263a]">{error}</p> : null}
    </Card>
  );
}

function ModuleRow({ module: m, index, refresh }: { module: AdminModule; index: number; refresh: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [description, setDescription] = useState(m.description ?? "");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<"text" | "video">("text");
  const [busy, setBusy] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/admin/modules/${m.id}`, { method: "PATCH", body: patch });
      refresh();
      setEdit(false);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ lesson: { _id: string } }>(`/admin/modules/${m.id}/lessons`, { method: "POST", body: { title: lessonTitle.trim(), type: lessonType } });
      router.push(`${CLASSROOM_URL}/admin/lessons/${res.lesson._id}`);
    } catch (err) {
      toast("error", errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="py-3 pr-1">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-lg pl-3 text-left sm:pl-1">
          <span className="font-mono text-[12.5px] text-muted">{String(index + 1).padStart(2, "0")}</span>
          <span className="min-w-0">
            <span className="block truncate text-[15.5px] text-ink">{m.title}</span>
            <span className="block text-[12.5px] text-muted">{m.lessons.length} lessons · {m.quiz ? `quiz (${m.quiz.questions} q, pass ${m.quiz.passPercent}%)` : "no quiz"}</span>
          </span>
        </button>
        <label className="flex items-center gap-1.5 text-[13px] text-ink-soft">
          <input type="checkbox" checked={m.isFreePreview} onChange={(e) => save({ isFreePreview: e.target.checked })} className="size-4 accent-[var(--brand)]" />
          Free preview
        </label>
        <Link href={`${CLASSROOM_URL}/admin/modules/${m.id}/quiz`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-soft ring-1 ring-line hover:bg-canvas">
          <HugeiconsIcon icon={CheckListIcon} size={15} strokeWidth={1.7} aria-hidden /> Quiz
        </Link>
        <Button variant="ghost" size="sm" onClick={() => setEdit((x) => !x)}>Edit</Button>
        <ConfirmDialog
          trigger={<button type="button" aria-label={`Delete module ${m.title}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-[#a3263a]"><HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.7} aria-hidden /></button>}
          title={`Delete "${m.title}"?`}
          body="Its lessons and quiz are deleted too. This is blocked if students are enrolled in the course."
          confirmLabel="Delete module"
          onConfirm={async () => {
            try {
              await api(`/admin/modules/${m.id}`, { method: "DELETE" });
              refresh();
            } catch (e) {
              throw new Error(e instanceof ApiError && e.code === "COURSE_HAS_STUDENTS" ? "Students are enrolled in this course, so modules can't be deleted." : errorMessage(e));
            }
          }}
        />
      </div>

      {edit ? (
        <div className="mt-2 grid gap-1 rounded-xl bg-canvas p-3 sm:ml-8">
          <Field label="Title">{(id) => <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label="Description (optional)">{(id) => <TextInput id={id} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEdit(false)}>Cancel</Button>
            <Button size="sm" loading={busy} onClick={() => save({ title: title.trim(), description: description.trim() })}>Save</Button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-line sm:ml-8">
          {m.lessons.length ? (
            <ReorderList
              label="lesson"
              items={m.lessons}
              onReorder={(ids) => api(`/admin/modules/${m.id}/lessons/order`, { method: "PUT", body: { lessonIds: ids } }).then(refresh, (e) => { toast("error", errorMessage(e)); refresh(); throw e; })}
              render={(l) => (
                <div className="flex items-center gap-2 py-2 pl-3 sm:pl-0">
                  <HugeiconsIcon icon={l.type === "video" ? PlayIcon : FileEditIcon} size={15} strokeWidth={1.7} aria-hidden className="shrink-0 text-muted" />
                  <Link href={`${CLASSROOM_URL}/admin/lessons/${l.id}`} className="link-grow min-w-0 flex-1 truncate text-[14.5px] text-ink">{l.title}</Link>
                  <span className="text-[12.5px] text-muted">{l.estimatedMinutes} min</span>
                </div>
              )}
            />
          ) : (
            <p className="px-4 py-3 text-[14px] text-muted">No lessons yet.</p>
          )}
          <form onSubmit={addLesson} className={cn("flex flex-col gap-2 border-t border-line bg-canvas p-3 sm:flex-row")}>
            <TextInput aria-label="New lesson title" placeholder="New lesson title" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
            <Select aria-label="Lesson type" value={lessonType} onChange={(e) => setLessonType(e.target.value as "text" | "video")} className="sm:w-32">
              <option value="text">Text</option>
              <option value="video">Video</option>
            </Select>
            <Button type="submit" loading={busy} disabled={lessonTitle.trim().length < 3}>Add lesson</Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
