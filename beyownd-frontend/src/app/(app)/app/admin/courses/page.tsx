"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Card, EmptyState, ErrorState, PageTitle, Pill, Skeleton, istDate, rupees } from "@/components/app/ui";
import { buttonVariants } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { AdminCourseRow } from "@/lib/staff-types";

const statusTone = { draft: "warn", published: "good", archived: "neutral" } as const;

export default function AdminCoursesPage() {
  const q = useQuery({ queryKey: ["admin-courses"], queryFn: () => api<{ courses: AdminCourseRow[] }>("/admin/courses") });
  const rows = q.data?.courses ?? [];
  return (
    <>
      <PageTitle
        title="Courses"
        sub="Drafts are only visible to admins. Publishing needs at least one module with lessons."
        actions={
          <Link href={`${CLASSROOM_URL}/admin/courses/new`} className={buttonVariants({ size: "md" })}>
            <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={1.8} aria-hidden /> New course
          </Link>
        }
      />
      {q.isPending ? (
        <Skeleton className="h-60" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No courses yet" body="Create the first one, or load one from a file with npm run import:course in the backend." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((c) => (
            <Link key={c.id} href={`${CLASSROOM_URL}/admin/courses/${c.id}`} className="group flex flex-col gap-1.5 px-5 py-4 hover:bg-[#fafbfc] sm:flex-row sm:items-center sm:gap-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15.5px] text-ink">{c.title} <Pill tone={statusTone[c.status]}>{c.status}</Pill></p>
                <p className="truncate font-mono text-[12px] text-muted">/programs/{c.slug}</p>
              </div>
              <p className="text-[13.5px] text-ink-soft sm:w-[260px]">{c.modules} modules · {c.lessons} lessons · {c.students} students</p>
              <p className="font-mono text-[13px] text-ink-soft sm:w-[80px] sm:text-right">{rupees(c.defaultPricePaise)}</p>
              <p className="text-[12.5px] text-muted sm:w-[110px] sm:text-right">{istDate(c.updatedAt)}</p>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden className="hidden text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
