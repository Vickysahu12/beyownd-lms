"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { useToast } from "@/components/app/toast";
import { Button, Card, EmptyState, ErrorState, Field, PageTitle, Pill, Select, Skeleton, TextInput, istDate, rupees } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { AdminCohort, AdminCourseRow } from "@/lib/staff-types";

/* Batches: real dates printed on letters, capacity, price (audit-logged), status, community link. */
const statusTone = { scheduled: "neutral", open: "good", running: "info", completed: "neutral", cancelled: "bad" } as const;

export default function CohortsPage() {
  const [courseId, setCourseId] = useState("");
  const courses = useQuery({ queryKey: ["admin-courses"], queryFn: () => api<{ courses: AdminCourseRow[] }>("/admin/courses") });
  const q = useQuery({ queryKey: ["admin-cohorts", courseId], queryFn: () => api<{ cohorts: AdminCohort[] }>(`/admin/cohorts${courseId ? `?courseId=${courseId}` : ""}`) });
  const courseList = courses.data?.courses ?? [];
  const titleOf = (id: string) => courseList.find((c) => c.id === id)?.title ?? "Course";
  const rows = q.data?.cohorts ?? [];

  return (
    <>
      <PageTitle
        title="Batches"
        sub="The dates here are printed on students' letters. Times are IST."
        actions={courseList.length ? <CohortDialog courses={courseList} trigger={<Button><HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} aria-hidden /> New batch</Button>} /> : null}
      />
      <Select aria-label="Filter by course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mb-4 sm:w-72">
        <option value="">All courses</option>
        {courseList.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </Select>
      {q.isPending ? (
        <Skeleton className="h-60" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No batches yet" body={courseList.length ? "Create one so students can enroll." : "Create a course first."} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[14px]">
            <thead className="border-b border-line bg-canvas text-[12.5px] text-muted">
              <tr>
                <th className="px-5 py-2.5 font-normal">Batch</th>
                <th className="px-3 py-2.5 font-normal">Dates</th>
                <th className="px-3 py-2.5 font-normal">Enrolment</th>
                <th className="px-3 py-2.5 text-right font-normal">Seats</th>
                <th className="px-3 py-2.5 text-right font-normal">Price</th>
                <th className="px-3 py-2.5 font-normal">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-[#fafbfc]">
                  <td className="px-5 py-3">
                    <p className="text-ink">{c.name}</p>
                    <p className="font-mono text-[12px] text-muted">{c.code} · {titleOf(c.courseId)}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-soft">{istDate(c.startDate)} – {istDate(c.endDate)}</td>
                  <td className="px-3 py-3 text-[13px] text-muted">{istDate(c.enrollOpensAt)} – {istDate(c.enrollClosesAt)}</td>
                  <td className="px-3 py-3 text-right font-mono">{c.seatsTaken} / {c.capacity}</td>
                  <td className="px-3 py-3 text-right font-mono">{rupees(c.pricePaise)}</td>
                  <td className="px-3 py-3"><Pill tone={statusTone[c.status]}>{c.status}</Pill></td>
                  <td className="px-5 py-3 text-right"><CohortDialog courses={courseList} cohort={c} trigger={<Button variant="ghost" size="sm">Edit</Button>} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

/* <input type="date"> works in local dates; we store IST midnight as UTC. */
const toDateInput = (iso?: string) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "");
const fromDateInput = (d: string) => new Date(`${d}T00:00:00+05:30`).toISOString();

function CohortDialog({ courses, cohort, trigger }: { courses: AdminCourseRow[]; cohort?: AdminCohort; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const init = () => ({
    courseId: cohort?.courseId ?? courses[0]?.id ?? "",
    name: cohort?.name ?? "",
    code: cohort?.code ?? "",
    startDate: toDateInput(cohort?.startDate),
    endDate: toDateInput(cohort?.endDate),
    enrollOpensAt: toDateInput(cohort?.enrollOpensAt),
    enrollClosesAt: toDateInput(cohort?.enrollClosesAt),
    capacity: String(cohort?.capacity ?? 100),
    price: cohort ? String(cohort.pricePaise / 100) : String((courses.find((c) => c.id === courses[0]?.id)?.defaultPricePaise ?? 59900) / 100),
    status: cohort?.status ?? "scheduled",
    communityLink: cohort?.communityLink ?? "",
  });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const priceChanged = cohort && Math.round(Number(f.price) * 100) !== cohort.pricePaise;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = {
      ...(cohort ? {} : { courseId: f.courseId }),
      name: f.name.trim(),
      code: f.code.trim().toUpperCase(),
      startDate: f.startDate && fromDateInput(f.startDate),
      endDate: f.endDate && fromDateInput(f.endDate),
      enrollOpensAt: f.enrollOpensAt && fromDateInput(f.enrollOpensAt),
      enrollClosesAt: f.enrollClosesAt && fromDateInput(f.enrollClosesAt),
      capacity: Number(f.capacity),
      pricePaise: Math.round(Number(f.price) * 100),
      status: f.status,
      communityLink: f.communityLink.trim() || undefined,
    };
    try {
      await api(cohort ? `/admin/cohorts/${cohort.id}` : "/admin/cohorts", { method: cohort ? "PATCH" : "POST", body });
      qc.invalidateQueries({ queryKey: ["admin-cohorts"] });
      toast("success", cohort ? "Batch updated." : "Batch created.");
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      const code = err instanceof ApiError ? err.code : "";
      setFormError(
        code === "CODE_TAKEN" ? "Another batch already uses this code." : code === "CAPACITY_BELOW_SEATS" ? "Capacity can't be lower than the seats already taken." : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof ReturnType<typeof init>, label: string, type = "text", hint?: string) => (
    <Field label={label} error={errors[k === "price" ? "pricePaise" : k]} hint={hint}>
      {(id, d) => <TextInput id={id} aria-describedby={d} type={type} invalid={!!errors[k]} value={f[k]} onChange={set(k)} />}
    </Field>
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) { setF(init()); setErrors({}); setFormError(null); } }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay fixed inset-0 z-[60] bg-ink/35" />
        <Dialog.Content className="dialog-pop fixed left-1/2 top-1/2 z-[61] max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] bg-white p-6 shadow-[var(--shadow-lift)]">
          <Dialog.Title className="text-[22px] font-light tracking-[-0.03em] text-ink">{cohort ? `Edit ${cohort.name}` : "New batch"}</Dialog.Title>
          <Dialog.Description className="mt-1 text-[14px] text-muted">Batch dates are printed on offer letters and certificates.</Dialog.Description>
          <form onSubmit={submit} noValidate className="mt-5 grid gap-x-4 sm:grid-cols-2">
            {!cohort ? (
              <Field label="Course" className="sm:col-span-2" error={errors.courseId}>
                {(id) => <Select id={id} value={f.courseId} onChange={set("courseId")}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}
              </Field>
            ) : null}
            {input("name", "Name", "text", "e.g. November batch")}
            {input("code", "Code", "text", "e.g. FSWD-NOV26")}
            {input("startDate", "Starts", "date")}
            {input("endDate", "Ends", "date")}
            {input("enrollOpensAt", "Enrolment opens", "date")}
            {input("enrollClosesAt", "Enrolment closes", "date")}
            {input("capacity", "Capacity (seats)", "number")}
            {input("price", "Price (₹)", "number", priceChanged ? "Price change is saved in the audit log" : undefined)}
            <Field label="Status" error={errors.status}>
              {(id) => (
                <Select id={id} value={f.status} onChange={set("status")}>
                  {["scheduled", "open", "running", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              )}
            </Field>
            {input("communityLink", "WhatsApp community link (https)", "url")}
            {formError ? <p role="alert" className="rounded-xl bg-[#fde8eb] px-3.5 py-2.5 text-[14px] text-[#a3263a] sm:col-span-2">{formError}</p> : null}
            <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
              <Dialog.Close asChild><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
              <Button type="submit" loading={busy}>{cohort ? "Save" : "Create batch"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
