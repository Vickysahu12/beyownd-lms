"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { MarkdownField } from "./markdown-field";
import { Button, Card, Field, Select, TextArea, TextInput } from "@/components/app/ui";
import { ApiError, errorMessage } from "@/lib/api";
import type { AdminCourse, RubricItem } from "@/lib/staff-types";

/*
 * Create / edit a course. Prices are typed in rupees and sent in paise.
 * Field errors come from the API's errors[] (express-validator) and are shown
 * under the matching field; model validation (400 VALIDATION_ERROR) and other
 * codes show as one message at the bottom.
 */
export type CoursePayload = {
  title: string;
  slug: string;
  tagline?: string;
  description: string;
  thumbnailUrl?: string;
  level: "beginner" | "intermediate";
  skills: string[];
  durationWeeks: number;
  defaultPricePaise: number;
  project: { title: string; brief: string; rubric: RubricItem[]; passScorePercent: number };
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function CourseForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: AdminCourse;
  submitLabel: string;
  onSubmit: (p: CoursePayload) => Promise<unknown>;
}) {
  const [f, setF] = useState(() => ({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    tagline: initial?.tagline ?? "",
    description: initial?.description ?? "",
    thumbnailUrl: initial?.thumbnailUrl ?? "",
    level: initial?.level ?? "beginner",
    skills: (initial?.skills ?? []).join(", "),
    durationWeeks: String(initial?.durationWeeks ?? 6),
    price: initial ? String(initial.defaultPricePaise / 100) : "599",
    projectTitle: initial?.project?.title ?? "",
    brief: initial?.project?.brief ?? "",
    pass: String(initial?.project?.passScorePercent ?? 60),
  }));
  const [rubric, setRubric] = useState<RubricItem[]>(
    initial?.project?.rubric?.length ? initial.project.rubric.map((r) => ({ criterion: r.criterion, maxScore: r.maxScore })) : [
      { criterion: "Works as described", maxScore: 10 },
      { criterion: "Code quality", maxScore: 10 },
      { criterion: "README and documentation", maxScore: 10 },
    ],
  );
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setF((x) => ({ ...x, [k]: v, ...(k === "title" && !slugTouched ? { slug: slugify(v) } : {}) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await onSubmit({
        title: f.title.trim(),
        slug: f.slug.trim(),
        tagline: f.tagline.trim() || undefined,
        description: f.description,
        thumbnailUrl: f.thumbnailUrl.trim() || undefined,
        level: f.level as CoursePayload["level"],
        skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
        durationWeeks: Number(f.durationWeeks),
        defaultPricePaise: Math.round(Number(f.price) * 100),
        project: { title: f.projectTitle.trim(), brief: f.brief, rubric: rubric.map((r) => ({ criterion: r.criterion.trim(), maxScore: Number(r.maxScore) })), passScorePercent: Number(f.pass) },
      });
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      setFormError(err instanceof ApiError && err.code === "SLUG_TAKEN" ? "Another course already uses this slug. Pick a different one." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k];
  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Card className="grid gap-1 p-6">
        <h2 className="mb-3 text-[18px] tracking-[-0.02em] text-ink">Basics</h2>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Title" error={err("title")}>{(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!err("title")} value={f.title} onChange={set("title")} />}</Field>
          <Field label="Slug (URL)" error={err("slug")} hint={`beyownd.in/programs/${f.slug || "…"}`}>
            {(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!err("slug")} value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug")(e); }} />}
          </Field>
        </div>
        <Field label="Tagline (one line on cards)" error={err("tagline")}>{(id, d) => <TextInput id={id} aria-describedby={d} maxLength={160} value={f.tagline} onChange={set("tagline")} />}</Field>
        <Field label="Description" error={err("description")}>{(id, d) => <TextArea id={id} aria-describedby={d} invalid={!!err("description")} value={f.description} onChange={set("description")} maxLength={5000} />}</Field>
        <div className="grid gap-x-4 sm:grid-cols-4">
          <Field label="Level" error={err("level")}>
            {(id, d) => <Select id={id} aria-describedby={d} value={f.level} onChange={set("level")}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option></Select>}
          </Field>
          <Field label="Weeks (4-12)" error={err("durationWeeks")}>{(id, d) => <TextInput id={id} aria-describedby={d} type="number" min={4} max={12} invalid={!!err("durationWeeks")} value={f.durationWeeks} onChange={set("durationWeeks")} />}</Field>
          <Field label="Default price (₹)" error={err("defaultPricePaise")}>{(id, d) => <TextInput id={id} aria-describedby={d} type="number" min={0} inputMode="decimal" invalid={!!err("defaultPricePaise")} value={f.price} onChange={set("price")} />}</Field>
          <Field label="Thumbnail URL (https)" error={err("thumbnailUrl")}>{(id, d) => <TextInput id={id} aria-describedby={d} type="url" invalid={!!err("thumbnailUrl")} value={f.thumbnailUrl} onChange={set("thumbnailUrl")} />}</Field>
        </div>
        <Field label="Skills (comma separated)" error={err("skills")} hint="e.g. HTML, CSS, JavaScript">{(id, d) => <TextInput id={id} aria-describedby={d} value={f.skills} onChange={set("skills")} />}</Field>
      </Card>

      <Card className="grid gap-1 p-6">
        <h2 className="mb-3 text-[18px] tracking-[-0.02em] text-ink">Final project</h2>
        <div className="grid gap-x-4 sm:grid-cols-[1fr_160px]">
          <Field label="Project title" error={err("project.title")}>{(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!err("project.title")} value={f.projectTitle} onChange={set("projectTitle")} />}</Field>
          <Field label="Pass mark (%)" error={err("project.passScorePercent")}>{(id, d) => <TextInput id={id} aria-describedby={d} type="number" min={1} max={100} value={f.pass} onChange={set("pass")} />}</Field>
        </div>
        <MarkdownField label="Brief (Markdown)" value={f.brief} onChange={(v) => setF((x) => ({ ...x, brief: v }))} error={err("project.brief")} rows={10} />
        <fieldset className="mt-2">
          <legend className="text-[14px] text-ink-soft">Rubric (3-8 criteria)</legend>
          {err("project.rubric") ? <p className="mt-1 text-[12.5px] text-[#b42335]">{err("project.rubric")}</p> : null}
          <ul className="mt-2 grid gap-2">
            {rubric.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <TextInput aria-label={`Criterion ${i + 1}`} value={r.criterion} onChange={(e) => setRubric((x) => x.map((y, j) => (j === i ? { ...y, criterion: e.target.value } : y)))} />
                <TextInput aria-label={`Max score for criterion ${i + 1}`} type="number" min={1} max={100} className="w-24" value={String(r.maxScore)} onChange={(e) => setRubric((x) => x.map((y, j) => (j === i ? { ...y, maxScore: Number(e.target.value) } : y)))} />
                <button type="button" aria-label={`Remove criterion ${i + 1}`} disabled={rubric.length <= 3} onClick={() => setRubric((x) => x.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas hover:text-[#a3263a] disabled:opacity-30">
                  <HugeiconsIcon icon={Delete02Icon} size={17} strokeWidth={1.7} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={rubric.length >= 8} onClick={() => setRubric((x) => [...x, { criterion: "", maxScore: 10 }])}>
            <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={1.8} aria-hidden /> Add criterion
          </Button>
        </fieldset>
      </Card>

      {formError ? <p role="alert" className="rounded-xl bg-[#fde8eb] px-4 py-3 text-[14px] text-[#a3263a]">{formError}</p> : null}
      <div className="flex justify-end"><Button type="submit" loading={busy}>{submitLabel}</Button></div>
    </form>
  );
}
