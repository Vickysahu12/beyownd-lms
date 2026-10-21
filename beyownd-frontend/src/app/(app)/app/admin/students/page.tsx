"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button, Card, EmptyState, ErrorState, PageTitle, Pill, Select, Skeleton, TextInput, istDate } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { AdminCohort, StudentRow } from "@/lib/staff-types";

const statuses = ["pending_payment", "active", "completed", "refunded", "cancelled"];

export default function StudentsPage() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [status, setStatus] = useState("");

  // Search waits 300 ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const cohorts = useQuery({ queryKey: ["admin-cohorts", ""], queryFn: () => api<{ cohorts: AdminCohort[] }>("/admin/cohorts") });
  const params = new URLSearchParams({ limit: "25", ...(q ? { q } : {}), ...(cohortId ? { cohortId } : {}), ...(status ? { status } : {}) });
  const list = useInfiniteQuery({
    queryKey: ["admin-students", q, cohortId, status],
    initialPageParam: "",
    queryFn: ({ pageParam }) => api<{ items: StudentRow[]; nextCursor: string | null }>(`/admin/students?${params}${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageTitle title="Students" sub="Search by name, email or college." />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px_200px]">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.7} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <TextInput aria-label="Search students" placeholder="Search" value={text} onChange={(e) => setText(e.target.value)} className="pl-10" />
        </div>
        <Select aria-label="Batch" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">All batches</option>
          {(cohorts.data?.cohorts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </Select>
        <Select aria-label="Enrollment status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
      </div>

      {list.isPending ? (
        <Skeleton className="h-72" />
      ) : list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No students found" body={q || cohortId || status ? "Try a different search or filter." : undefined} />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((s) => (
            <Link key={s.id} href={`${CLASSROOM_URL}/admin/students/${s.id}`} className="group flex flex-col gap-1 px-5 py-3.5 hover:bg-[#fafbfc] sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
                  {s.certificateName ?? s.name}
                  {s.role !== "student" ? <Pill tone="info">{s.role}</Pill> : null}
                  {!s.isVerified ? <Pill tone="warn">unverified</Pill> : null}
                </p>
                <p className="truncate text-[13px] text-muted">{s.email}{s.college ? ` · ${s.college}` : ""}</p>
              </div>
              <p className="flex flex-wrap gap-1 sm:w-[260px] sm:justify-end">
                {Object.entries(s.enrollments).map(([k, n]) => (
                  <Pill key={k} tone={k === "completed" ? "good" : k === "active" ? "info" : k === "refunded" ? "bad" : "neutral"}>{n} {k.replace("_", " ")}</Pill>
                ))}
              </p>
              <p className="text-[12.5px] text-muted sm:w-[100px] sm:text-right">{istDate(s.joinedAt)}</p>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden className="hidden text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
            </Link>
          ))}
        </Card>
      )}
      {list.hasNextPage ? (
        <div className="mt-4 flex justify-center"><Button variant="outline" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button></div>
      ) : null}
    </>
  );
}
