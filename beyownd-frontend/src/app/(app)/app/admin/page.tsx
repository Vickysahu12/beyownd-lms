"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Card, ErrorState, PageTitle, Select, Skeleton, rupees } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { AdminCourseRow, CollegeRow, Funnel, Overview } from "@/lib/staff-types";

/* Stats dashboard: overview tiles + alerts, per-course funnel, colleges. */
export default function AdminOverviewPage() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<{ stats: Overview }>("/admin/stats/overview") });
  const s = q.data?.stats;

  return (
    <>
      <PageTitle title="Overview" sub="Live numbers from the database." />
      {q.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : s ? (
        <>
          {s.alerts.pendingReviews || s.alerts.refundsToProcess ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {s.alerts.pendingReviews ? <Alert href={`${CLASSROOM_URL}/review`} text={`${s.alerts.pendingReviews} project${s.alerts.pendingReviews === 1 ? "" : "s"} waiting for review`} /> : null}
              {s.alerts.refundsToProcess ? <Alert href={`${CLASSROOM_URL}/admin/students`} text={`${s.alerts.refundsToProcess} payment${s.alerts.refundsToProcess === 1 ? "" : "s"} need a refund (batch was full)`} /> : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Students" value={s.students.total} sub={`${s.students.newThisWeek} new this week`} />
            <Tile label="Onboarded" value={s.students.onboarded} sub={`${s.students.verified} verified emails`} />
            <Tile label="Paid enrollments" value={(s.enrollments.active ?? 0) + (s.enrollments.completed ?? 0)} sub={`${s.enrollments.activeThisWeek} active this week`} />
            <Tile label="Revenue" value={rupees(s.revenue.paidPaise)} sub={`${s.revenue.paidCount} payments · ${rupees(s.revenue.refundedPaise)} refunded`} />
            <Tile label="Completed" value={s.enrollments.completed ?? 0} sub={`${s.enrollments.pending_payment ?? 0} waiting for payment`} />
            <Tile label="Certificates" value={s.documentsIssued.certificate ?? 0} sub={`${s.documentsIssued.offer_letter ?? 0} offer letters`} />
            <Tile label="Completion letters" value={s.documentsIssued.completion_letter ?? 0} />
            <Tile label="Refunded" value={s.enrollments.refunded ?? 0} />
          </div>
        </>
      ) : null}

      <FunnelCard />
      <CollegesCard />
    </>
  );
}

function Alert({ href, text }: { href: string; text: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl bg-butter px-4 py-3 text-[14.5px] text-[#5c4700]">
      <HugeiconsIcon icon={Alert02Icon} size={18} strokeWidth={1.7} aria-hidden />
      <span className="flex-1">{text}</span>
      <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-[30px] font-light tabular-nums tracking-[-0.03em] text-ink">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
      {sub ? <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p> : null}
    </Card>
  );
}

function FunnelCard() {
  const courses = useQuery({ queryKey: ["admin-courses"], queryFn: () => api<{ courses: AdminCourseRow[] }>("/admin/courses") });
  const list = courses.data?.courses ?? [];
  const [picked, setPicked] = useState("");
  const courseId = picked || list[0]?.id || "";
  const f = useQuery({ queryKey: ["admin-funnel", courseId], enabled: !!courseId, queryFn: () => api<{ funnel: Funnel }>(`/admin/stats/funnel?courseId=${courseId}`) });
  const funnel = f.data?.funnel;
  const steps = funnel
    ? [
        { label: "Enrolled", n: funnel.enrolled },
        ...funnel.modules.map((m) => ({ label: `${m.order}. ${m.title}`, n: m.completed, sub: `${m.started} started` })),
        { label: "Project submitted", n: funnel.project.submitted },
        { label: "Project approved", n: funnel.project.approved },
        { label: "Completed", n: funnel.completed },
      ]
    : [];
  const top = Math.max(1, funnel?.enrolled ?? 1);

  return (
    <Card className="mt-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[19px] tracking-[-0.02em] text-ink">Course funnel</h2>
          <p className="text-[13px] text-muted">Where students drop off. Counts are students who completed each step.</p>
        </div>
        {list.length ? (
          <Select aria-label="Course" value={courseId} onChange={(e) => setPicked(e.target.value)} className="sm:w-64">
            {list.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        ) : null}
      </div>
      {courses.isPending || (courseId && f.isPending) ? (
        <Skeleton className="mt-5 h-48" />
      ) : f.isError ? (
        <div className="mt-5"><ErrorState message={errorMessage(f.error)} onRetry={() => f.refetch()} /></div>
      ) : !courseId ? (
        <p className="mt-5 text-[14.5px] text-muted">Create a course to see its funnel.</p>
      ) : (
        <ol className="mt-5 space-y-2.5">
          {steps.map((st) => {
            const pct = Math.round((st.n / top) * 100);
            return (
              <li key={st.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[220px_minmax(0,1fr)_90px]">
                <span className="truncate text-[14px] text-ink">{st.label}</span>
                <span className="order-3 col-span-2 block h-2.5 overflow-hidden rounded-full bg-canvas sm:order-none sm:col-span-1">
                  <span className="block h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right font-mono text-[13px] text-ink-soft">{st.n} · {pct}%</span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function CollegesCard() {
  const q = useQuery({ queryKey: ["admin-colleges"], queryFn: () => api<{ colleges: CollegeRow[] }>("/admin/stats/colleges?limit=50") });
  const rows = q.data?.colleges ?? [];
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="p-6 pb-3">
        <h2 className="text-[19px] tracking-[-0.02em] text-ink">Colleges</h2>
        <p className="text-[13px] text-muted">Signups and paid students per college.</p>
      </div>
      {q.isPending ? (
        <div className="p-6 pt-0"><Skeleton className="h-40" /></div>
      ) : q.isError ? (
        <div className="p-6 pt-0"><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>
      ) : rows.length === 0 ? (
        <p className="px-6 pb-6 text-[14.5px] text-muted">No colleges yet. They appear once students finish onboarding.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[14px]">
            <thead className="border-y border-line bg-canvas text-[12.5px] text-muted">
              <tr><th className="px-6 py-2.5 font-normal">College</th><th className="px-4 py-2.5 text-right font-normal">Students</th><th className="px-4 py-2.5 text-right font-normal">Paid</th><th className="px-6 py-2.5 text-right font-normal">Conversion</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.collegeId} className="hover:bg-[#fafbfc]">
                  <td className="px-6 py-3 text-ink">{r.college ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.students}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.paidStudents}</td>
                  <td className="px-6 py-3 text-right font-mono text-ink-soft">{r.students ? Math.round((r.paidStudents / r.students) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
