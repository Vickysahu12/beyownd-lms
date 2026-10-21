"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, ErrorState, PageTitle, Pill, Skeleton, istDate, rupees } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/api";
import { CONTACT_EMAIL } from "@/lib/site";
import type { MyEnrollment, MyPayment } from "@/lib/student-types";

/* Payment history: only real money movements (paid / refunded). */
const methods: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI" };

export default function PaymentsPage() {
  const q = useQuery({ queryKey: ["my-payments"], queryFn: () => api<{ payments: MyPayment[] }>("/payments") });
  const enr = useQuery({ queryKey: ["my-enrollments"], queryFn: () => api<{ enrollments: MyEnrollment[] }>("/enrollments") });
  const programOf = (id: string) => enr.data?.enrollments.find((e) => e.id === id);
  const list = q.data?.payments ?? [];

  return (
    <>
      <PageTitle title="Payments" sub={`Questions about a payment? Email ${CONTACT_EMAIL} with the payment ID.`} />
      {q.isPending ? (
        <Skeleton className="h-40" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="No payments yet" body="When you join a batch, the payment shows up here." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((p) => {
            const e = programOf(p.enrollmentId);
            return (
              <div key={p.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-ink">{e?.course?.title ?? "Program"}{e?.cohort ? ` · ${e.cohort.name}` : ""}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {istDate(p.paidAt ?? p.createdAt, true)}
                    {p.method ? ` · ${methods[p.method] ?? p.method}` : ""}
                    {p.razorpayPaymentId ? <> · <span className="select-all font-mono">{p.razorpayPaymentId}</span></> : null}
                  </p>
                  {p.status === "refunded" && p.refundedAt ? <p className="mt-0.5 text-[12.5px] text-muted">Refunded {istDate(p.refundedAt)}</p> : null}
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <span className="font-mono text-[15px] text-ink">{rupees(p.amountPaise)}</span>
                  {p.status === "paid" ? <Pill tone="good">Paid</Pill> : p.status === "refunded" ? <Pill tone="bad">Refunded</Pill> : <Pill>{p.status}</Pill>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
