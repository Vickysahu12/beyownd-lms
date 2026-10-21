"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Clock01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Card, Skeleton } from "@/components/app/ui";
import { api } from "@/lib/api";
import { CLASSROOM_URL, CONTACT_EMAIL } from "@/lib/site";
import type { MyEnrollment } from "@/lib/student-types";

/*
 * After Razorpay. `o` is the verify outcome: activated / already_processed →
 * success; cohort_full_refund_required → honest message; pending (verify
 * couldn't confirm) → poll GET /enrollments for ~90 s while the webhook
 * activates it.
 */
const POLL_MS = 3000;
const POLL_FOR_MS = 90_000;

export default function PaymentStatusPage() {
  const params = useSearchParams();
  const id = params.get("e");
  const outcome = params.get("o");
  const qc = useQueryClient();
  const [started] = useState(() => Date.now());
  const [gaveUp, setGaveUp] = useState(false);

  const q = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => api<{ enrollments: MyEnrollment[] }>("/enrollments"),
    refetchInterval: (query) => {
      const e = query.state.data?.enrollments.find((x) => x.id === id);
      return e && e.status !== "pending_payment" ? false : gaveUp ? false : POLL_MS;
    },
  });
  const e = q.data?.enrollments.find((x) => x.id === id);
  const active = e?.status === "active" || e?.status === "completed";

  useEffect(() => {
    if (active || gaveUp) return;
    const t = setTimeout(() => setGaveUp(true), Math.max(0, POLL_FOR_MS - (Date.now() - started)));
    return () => clearTimeout(t);
  }, [active, gaveUp, started]);

  // Documents list should show the new offer letter.
  useEffect(() => {
    if (active) qc.invalidateQueries({ queryKey: ["my-credentials"] });
  }, [active, qc]);

  if (outcome === "cohort_full_refund_required") {
    return (
      <Result tone="info" title="The batch filled up while you were paying" icon={InformationCircleIcon}>
        <p>Your payment went through, but the last seat was taken a moment before. You won&apos;t lose money: our team refunds the full amount to the same account and will email you when it&apos;s done.</p>
        <p className="mt-2">If you&apos;d rather join another batch instead, email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </Result>
    );
  }

  if (q.isPending) return <Skeleton className="mx-auto h-72 max-w-[560px]" />;

  if (active && e) {
    return (
      <Result tone="good" title="You're in!" icon={CheckmarkCircle02Icon}>
        <p>
          You&apos;re enrolled in <b className="font-medium text-ink">{e.course?.title}</b>
          {e.cohort ? ` (${e.cohort.name})` : ""}. Your offer letter is being prepared and will appear in Documents in a minute.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href={`${CLASSROOM_URL}/learn/${e.id}`} className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">Open my program</Link>
          <Link href={`${CLASSROOM_URL}/documents`} className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] text-ink ring-1 ring-inset ring-line-strong hover:bg-canvas">Documents</Link>
        </div>
      </Result>
    );
  }

  return (
    <Result tone="wait" title={gaveUp ? "Still confirming your payment" : "Confirming your payment…"} icon={Clock01Icon}>
      {gaveUp ? (
        <>
          <p>This is taking longer than usual. If money was deducted, your enrollment activates automatically, usually within a few minutes. You don&apos;t need to pay again.</p>
          <p className="mt-2">Check your <Link href={`${CLASSROOM_URL}/dashboard`} className="underline">dashboard</Link> shortly, or email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your payment ID.</p>
        </>
      ) : (
        <p>Please keep this page open. This usually takes a few seconds. Don&apos;t pay again.</p>
      )}
    </Result>
  );
}

function Result({ tone, title, icon, children }: { tone: "good" | "wait" | "info"; title: string; icon: typeof Clock01Icon; children: React.ReactNode }) {
  const tint = tone === "good" ? "bg-mint text-success-ink" : tone === "wait" ? "bg-butter text-[#6b5000]" : "bg-brand-wash text-brand";
  return (
    <Card className="mx-auto mt-4 max-w-[560px] p-7 text-[15px] leading-relaxed text-ink-soft sm:p-9">
      <div role="status" aria-live="polite">
        <span className={`grid size-12 place-items-center rounded-2xl ${tint}`}>
          <HugeiconsIcon icon={icon} size={24} strokeWidth={1.7} aria-hidden className={tone === "wait" ? "animate-pulse motion-reduce:animate-none" : undefined} />
        </span>
        <h1 className="mt-4 text-[26px] font-light tracking-[-0.03em] text-ink">{title}</h1>
        <div className="mt-2">{children}</div>
      </div>
    </Card>
  );
}
