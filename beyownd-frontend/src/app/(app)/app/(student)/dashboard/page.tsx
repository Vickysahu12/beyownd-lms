"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, File02Icon } from "@hugeicons/core-free-icons";
import { useAuth } from "@/components/app/auth-provider";
import { DocPill } from "@/components/app/doc-pill";
import { Card, EmptyState, ErrorState, PageTitle, Pill, Progress, Skeleton, istDate } from "@/components/app/ui";
import { coverFor } from "@/lib/catalog";
import { api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL, MARKETING_URL, enrollUrl } from "@/lib/site";
import type { MyCredential, MyEnrollment } from "@/lib/student-types";

/* Home after login: my programs with progress, and a documents summary. */
export default function DashboardPage() {
  const { user } = useAuth();
  const enr = useQuery({ queryKey: ["my-enrollments"], queryFn: () => api<{ enrollments: MyEnrollment[] }>("/enrollments") });
  const docs = useQuery({ queryKey: ["my-credentials"], queryFn: () => api<{ credentials: MyCredential[] }>("/credentials") });
  const list = enr.data?.enrollments ?? [];
  const first = user?.name.split(" ")[0];

  return (
    <>
      <PageTitle title={first ? `Hi, ${first}` : "Dashboard"} sub="Your programs and documents." />

      <section aria-labelledby="programs-h">
        <h2 id="programs-h" className="sr-only">My programs</h2>
        {enr.isPending ? (
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-[220px]" /><Skeleton className="h-[220px]" /></div>
        ) : enr.isError ? (
          <ErrorState message={errorMessage(enr.error)} onRetry={() => enr.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="You haven't joined a program yet" body="Pick a program and a batch. You get an offer letter as soon as you enroll.">
            <Link href={`${MARKETING_URL}/programs`} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">
              See programs <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden />
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {list.map((e) => <ProgramCard key={e.id} e={e} />)}
          </ul>
        )}
      </section>

      <section aria-labelledby="docs-h" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="docs-h" className="text-[19px] tracking-[-0.02em] text-ink">Documents</h2>
          <Link href={`${CLASSROOM_URL}/documents`} className="link-grow text-[14px] text-brand">All documents</Link>
        </div>
        {docs.isPending ? (
          <Skeleton className="h-24" />
        ) : docs.isError ? (
          <ErrorState message={errorMessage(docs.error)} onRetry={() => docs.refetch()} />
        ) : (docs.data?.credentials.length ?? 0) === 0 ? (
          <Card className="p-5 text-[14.5px] text-muted">Your offer letter appears here after you enroll. The certificate and completion letter come after you finish the program and the batch ends.</Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {docs.data!.credentials.slice(0, 3).map((c) => (
              <Link key={c.credentialId} href={`${CLASSROOM_URL}/documents`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#fafbfc]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-wash text-brand"><HugeiconsIcon icon={File02Icon} size={18} strokeWidth={1.6} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{c.label}</span>
                  <span className="block truncate text-[12.5px] text-muted">{c.courseTitle}</span>
                </span>
                <DocPill status={c.status} />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}

function ProgramCard({ e }: { e: MyEnrollment }) {
  const title = e.course?.title ?? "Program";
  const cover = e.course ? coverFor({ slug: e.course.slug, title, thumbnailUrl: e.course.thumbnailUrl }) : "/illustrations/cover-default.svg";
  const notStarted = e.cohort && new Date(e.cohort.startDate) > new Date();
  const usable = e.status === "active" || e.status === "completed";
  const href = usable ? `${CLASSROOM_URL}/learn/${e.id}` : e.status === "pending_payment" && e.course && e.cohort ? enrollUrl(e.course.slug, e.cohort.id) : null;

  const body = (
    <Card className="flex h-full flex-col overflow-hidden transition-[box-shadow,transform] duration-200 ease-out [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:shadow-[var(--shadow-board)]">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- small local SVG covers */}
          <img src={cover} alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl bg-canvas object-cover ring-1 ring-line" />
          <div className="min-w-0">
            <EnrollmentPill e={e} notStarted={!!notStarted} />
            <h3 className="mt-1.5 text-[18px] leading-snug tracking-[-0.02em] text-ink">{title}</h3>
            {e.cohort ? <p className="mt-0.5 text-[13px] text-muted">{e.cohort.name} · {istDate(e.cohort.startDate)} – {istDate(e.cohort.endDate)}</p> : null}
          </div>
        </div>
        {usable ? (
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-muted">Progress</span><span className="tabular-nums text-ink">{e.percentComplete}%</span></div>
            <Progress value={e.percentComplete} label={`${title} progress`} />
          </div>
        ) : null}
        {href ? (
          <span className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-brand">
            {e.status === "pending_payment" ? "Complete payment" : e.percentComplete > 0 ? "Continue" : notStarted ? "Open program" : "Start learning"}
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        ) : null}
      </div>
    </Card>
  );

  return <li>{href ? <Link href={href} className="group block h-full rounded-[20px]">{body}</Link> : body}</li>;
}

function EnrollmentPill({ e, notStarted }: { e: MyEnrollment; notStarted: boolean }) {
  if (e.status === "completed") return <Pill tone="good">Completed</Pill>;
  if (e.status === "active") return notStarted ? <Pill tone="info">Starts soon</Pill> : <Pill tone="info">In progress</Pill>;
  if (e.status === "pending_payment") return <Pill tone="warn">Payment pending</Pill>;
  if (e.status === "refunded") return <Pill tone="bad">Refunded</Pill>;
  return <Pill>{e.status.replace(/_/g, " ")}</Pill>;
}
