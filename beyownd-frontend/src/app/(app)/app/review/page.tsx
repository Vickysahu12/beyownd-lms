"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Github01Icon } from "@hugeicons/core-free-icons";
import { Button, Card, EmptyState, ErrorState, PageTitle, Skeleton, istDate } from "@/components/app/ui";
import { StatusPill } from "@/components/app/status-pill";
import { api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { QueueItem, SubmissionStatus } from "@/lib/staff-types";
import { cn } from "@/lib/utils";

/* Mentor queue: pending oldest first, reviewed newest first (API order). */
const tabs: { id: SubmissionStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "changes_requested", label: "Changes requested" },
  { id: "approved", label: "Approved" },
];

export default function ReviewQueuePage() {
  const [status, setStatus] = useState<SubmissionStatus>("pending");
  const q = useInfiniteQuery({
    queryKey: ["review-queue", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api<{ items: QueueItem[]; nextCursor: string | null }>(`/review/submissions?status=${status}&limit=20${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageTitle title="Review queue" sub="Final projects waiting for a mentor. Oldest first, so nobody waits too long." />
      <div role="tablist" aria-label="Status" className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-line [scrollbar-width:none] sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={status === t.id}
            onClick={() => setStatus(t.id)}
            className={cn("shrink-0 rounded-full px-4 py-2 text-[14px] transition-colors duration-150", status === t.id ? "bg-brand-wash text-brand" : "text-ink-soft hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <div className="grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[84px]" />)}</div>
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={status === "pending" ? "Nothing to review" : "No submissions here yet"} body={status === "pending" ? "New project submissions will show up here." : undefined} />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {items.map((s) => (
            <Link key={s.id} href={`${CLASSROOM_URL}/review/${s.id}`} className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-[#fafbfc] sm:flex-row sm:items-center sm:gap-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15.5px] text-ink">
                  {s.student.name}
                  <StatusPill status={s.status} />
                  {s.version > 1 ? <span className="text-[12.5px] text-muted">Version {s.version}</span> : null}
                </p>
                <p className="mt-0.5 truncate text-[13.5px] text-muted">
                  {s.course.title ?? "Course"}{s.cohort ? ` · ${s.cohort.name}` : ""}{s.student.college ? ` · ${s.student.college}` : ""}
                </p>
              </div>
              <p className="flex items-center gap-1.5 truncate font-mono text-[12px] text-ink-soft sm:max-w-[260px]">
                <HugeiconsIcon icon={Github01Icon} size={14} strokeWidth={1.7} aria-hidden className="shrink-0" />
                {s.repoUrl.replace("https://github.com/", "")}
              </p>
              <p className="shrink-0 text-[13px] text-muted sm:w-[110px] sm:text-right">{istDate(s.submittedAt)}</p>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden className="hidden shrink-0 text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
            </Link>
          ))}
        </Card>
      )}
      {q.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button>
        </div>
      ) : null}
    </>
  );
}
