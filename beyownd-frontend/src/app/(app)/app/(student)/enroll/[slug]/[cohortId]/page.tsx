"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, CheckmarkCircle02Icon, LockIcon } from "@hugeicons/core-free-icons";
import { FormError } from "@/components/app/auth-shell";
import { CheckoutClosed, openCheckout } from "@/components/app/razorpay";
import { Button, Card, ErrorState, PageTitle, Skeleton, istDate, rupees } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { CohortSummary, CourseDetail } from "@/lib/catalog";
import { CLASSROOM_URL, MARKETING_URL } from "@/lib/site";
import type { Checkout } from "@/lib/student-types";

/*
 * Checkout (PAGES.md §4). Summary first, then Razorpay Checkout with the
 * `checkout` object from POST /enrollments, then POST /payments/verify.
 * If verify can't confirm, the status page polls: the webhook activates it.
 */
const included = [
  "Offer letter as soon as you enroll",
  "Weekly modules with quizzes and a final project",
  "Mentor review of your project",
  "Completion certificate and letter, each with a public verify link",
];

export default function CheckoutPage() {
  const { slug, cohortId } = useParams<{ slug: string; cohortId: string }>();
  const router = useRouter();
  const course = useQuery({ queryKey: ["course", slug], queryFn: () => api<{ course: CourseDetail }>(`/courses/${encodeURIComponent(slug)}`, { auth: false }) });
  const cohorts = useQuery({ queryKey: ["cohorts", slug], queryFn: () => api<{ cohorts: CohortSummary[] }>(`/courses/${encodeURIComponent(slug)}/cohorts`, { auth: false }) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);

  const programHref = `${MARKETING_URL}/programs/${slug}`;
  const back = (
    <Link href={programHref} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
      <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> Program details
    </Link>
  );

  if (course.isPending || cohorts.isPending) return <div className="grid gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-80 max-w-180" /></div>;
  if (course.isError) return <ErrorState message={course.error instanceof ApiError && course.error.status === 404 ? "We couldn't find this program." : errorMessage(course.error)} onRetry={() => course.refetch()} />;
  if (cohorts.isError) return <ErrorState message={errorMessage(cohorts.error)} onRetry={() => cohorts.refetch()} />;

  const c = course.data.course;
  const cohort = cohorts.data.cohorts.find((x) => x.id === cohortId);

  if (!cohort || !cohort.enrollable) {
    return (
      <>
        {back}
        <PageTitle title="This batch isn't open" sub={cohort ? `${cohort.name} is ${cohort.seatsLeft === 0 ? "full" : "closed for enrollment"}.` : "This batch doesn't exist or was removed."} />
        <Link href={`${programHref}#batches`} className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">See other batches</Link>
      </>
    );
  }

  const pay = async () => {
    setBusy(true);
    setError(null);
    let enrollmentId = "";
    let checkout: Checkout;
    try {
      const res = await api<{ enrollment: { id: string; status: string }; checkout: Checkout }>("/enrollments", { method: "POST", body: { cohortId } });
      enrollmentId = res.enrollment.id;
      checkout = res.checkout;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "ALREADY_ENROLLED")
        setError(
          <>
            You&apos;re already enrolled in this program. <Link href={`${CLASSROOM_URL}/dashboard`} className="underline">Go to your dashboard</Link>.
          </>,
        );
      else if (code === "COHORT_FULL") setError("This batch just filled up. Please pick another batch.");
      else if (code === "ENROLLMENT_CLOSED") setError("Enrollment for this batch has closed. Please pick another batch.");
      else if (code === "PAYMENT_PROVIDER_ERROR") setError("Our payment partner isn't responding. Please try again in a minute. You haven't been charged.");
      else setError(errorMessage(err));
      setBusy(false);
      return;
    }

    const status = (q: string) => router.push(`${CLASSROOM_URL}/enroll/${slug}/${cohortId}/status?e=${enrollmentId}${q}`);
    try {
      const r = await openCheckout(checkout);
      try {
        const v = await api<{ outcome: string }>("/payments/verify", {
          method: "POST",
          body: { razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature },
        });
        status(`&o=${v.outcome}`);
      } catch {
        // Money may have moved; the webhook will activate it. Never say "failed" here.
        status("&o=pending");
      }
    } catch (err) {
      if (err instanceof CheckoutClosed && err.reason === "failed") setError(`Payment didn't go through${err.detail ? `: ${err.detail}` : ""}. You can try again. If money was deducted for a failed payment, your bank returns it.`);
      else if (err instanceof CheckoutClosed && err.reason === "load") setError("Couldn't open the payment window. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      {back}
      <PageTitle title="Confirm your enrollment" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <p className="text-[13px] text-muted">Program</p>
          <h2 className="mt-0.5 text-[22px] leading-snug tracking-[-0.02em] text-ink">{c.title}</h2>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-[14px] sm:gap-3 sm:text-[14.5px]">
            <div className="rounded-2xl bg-canvas p-3 sm:p-3.5"><dt className="text-[12.5px] text-muted">Batch</dt><dd className="mt-0.5 text-ink">{cohort.name}</dd></div>
            <div className="rounded-2xl bg-canvas p-3 sm:p-3.5"><dt className="text-[12.5px] text-muted">Starts</dt><dd className="mt-0.5 text-ink">{istDate(cohort.startDate)}</dd></div>
            <div className="rounded-2xl bg-canvas p-3 sm:p-3.5"><dt className="text-[12.5px] text-muted">Ends</dt><dd className="mt-0.5 text-ink">{istDate(cohort.endDate)}</dd></div>
          </dl>
          <h3 className="mt-6 text-[15px] text-ink">What&apos;s included</h3>
          <ul className="mt-2 grid gap-2 text-[14.5px] text-ink-soft">
            {included.map((x) => (
              <li key={x} className="flex gap-2.5">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0 text-success-ink" />
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-2xl bg-butter px-4 py-3 text-[13.5px] leading-snug text-[#5c4700]">
            Your certificate and completion letter are issued after you finish the program and the batch ends on {istDate(cohort.endDate)}. They are dated with the batch dates.
          </p>
        </Card>

        <Card className="h-fit p-6 lg:sticky lg:top-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[14.5px] text-ink-soft">Total</span>
            <span className="text-[30px] font-light tracking-[-0.03em] text-ink">{rupees(cohort.pricePaise)}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted">One-time payment for this batch.</p>
          {cohort.seatsLeft > 0 && cohort.seatsLeft <= 10 ? <p className="mt-3 text-[13px] text-[#a3263a]">Only {cohort.seatsLeft} seats left in this batch.</p> : null}
          <div className="mt-5">
            <FormError>{error}</FormError>
            <Button onClick={pay} loading={busy} className="w-full">
              <HugeiconsIcon icon={LockIcon} size={16} strokeWidth={1.8} aria-hidden /> Pay {rupees(cohort.pricePaise)}
            </Button>
          </div>
          <p className="mt-3 text-center text-[12.5px] leading-snug text-muted">
            Secure payment by Razorpay: UPI, cards, net banking. See our <Link href={`${MARKETING_URL}/refund-policy`} className="underline">refund policy</Link>.
          </p>
        </Card>
      </div>
    </>
  );
}
