"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useAuth } from "@/components/app/auth-provider";
import { StatusPill } from "@/components/app/status-pill";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, PageTitle, Pill, Select, Skeleton, istDate, rupees } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import type { StudentDetail } from "@/lib/staff-types";

/*
 * One student: profile, enrollments (refund / reissue), payments, documents
 * (revoke), submissions, role. Every destructive action goes through a
 * confirm dialog; refund and revoke require a reason for the audit log.
 */
const codeMessages: Record<string, string> = {
  NO_PAID_PAYMENT: "There's no paid payment for this enrollment, so it can't be marked refunded.",
  ALREADY_REVOKED: "This document is already revoked.",
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  ENROLLMENT_NOT_ACTIVE: "Documents can only be reissued for active or completed enrollments.",
};
const explain = (e: unknown) => new Error(e instanceof ApiError && codeMessages[e.code] ? codeMessages[e.code] : errorMessage(e));

export default function StudentDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["admin-student", userId];
  const q = useQuery({ queryKey: key, queryFn: () => api<StudentDetail>(`/admin/students/${userId}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  };

  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-60" /></div>;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const { user, enrollments, payments, credentials, submissions } = q.data;
  const profile = (user.profile ?? {}) as Record<string, string | number | undefined>;

  const run = (fn: () => Promise<unknown>, success: string) => async () => {
    try {
      await fn();
      toast("success", success);
      refresh();
    } catch (e) {
      throw explain(e);
    }
  };

  return (
    <>
      <Link href={`${CLASSROOM_URL}/admin/students`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink">
        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={1.8} aria-hidden /> All students
      </Link>
      <PageTitle title={String(profile.certificateName ?? user.name)} sub={`${user.email} · joined ${istDate(user.joinedAt)}`} actions={<RoleControl userId={user.id} role={user.role} onDone={refresh} />} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="p-5">
          <h2 className="text-[17px] tracking-[-0.02em] text-ink">Profile</h2>
          <dl className="mt-3 grid gap-2 text-[14px]">
            {[
              ["Name on certificate", profile.certificateName],
              ["Phone (WhatsApp)", profile.phone],
              ["College", profile.collegeName],
              ["Degree", [profile.degree, profile.branch].filter(Boolean).join(", ")],
              ["Year", profile.currentYear],
              ["Graduating", profile.graduationYear],
              ["City", [profile.city, profile.state].filter(Boolean).join(", ")],
              ["Sign-in", user.authProviders.join(", ")],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right text-ink">{v ? String(v) : "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex flex-wrap gap-1.5">
            {user.isVerified ? <Pill tone="good">Email verified</Pill> : <Pill tone="warn">Email not verified</Pill>}
            {user.onboardingCompleted ? <Pill tone="good">Onboarded</Pill> : <Pill tone="warn">Not onboarded</Pill>}
          </p>
        </Card>

        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <h2 className="px-5 pb-2 pt-5 text-[17px] tracking-[-0.02em] text-ink">Enrollments</h2>
            {enrollments.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-muted">No enrollments.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {enrollments.map((e) => (
                  <li key={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink">{e.course?.title ?? "Course"} <StatusPill status={e.status} /></p>
                      <p className="text-[13px] text-muted">
                        {e.cohort?.name ?? "Batch"} · {istDate(e.cohort?.startDate)} – {istDate(e.cohort?.endDate)}
                        {typeof e.percentComplete === "number" ? ` · ${e.percentComplete}% done` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["active", "completed"].includes(e.status) ? (
                        <ConfirmDialog
                          trigger={<Button variant="outline" size="sm">Reissue documents</Button>}
                          title="Reissue documents?"
                          body="Regenerates any missing or stuck PDFs. The credential IDs stay the same, so existing verify links keep working."
                          confirmLabel="Reissue"
                          danger={false}
                          onConfirm={run(() => api(`/admin/enrollments/${e.id}/credentials/reissue`, { method: "POST" }), "Documents queued for reissue.")}
                        />
                      ) : null}
                      {["active", "completed"].includes(e.status) ? (
                        <ConfirmDialog
                          trigger={<Button variant="danger" size="sm">Mark refunded</Button>}
                          title="Mark this enrollment refunded?"
                          body={<>Do this <b>after</b> you have refunded the payment in the Razorpay dashboard. The student loses access and all their documents for this program are revoked. This can&apos;t be undone.</>}
                          confirmLabel="Mark refunded"
                          reason
                          onConfirm={(reason) => run(() => api(`/admin/enrollments/${e.id}/refund`, { method: "POST", body: { reason } }), "Marked refunded. Documents revoked.")()}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <h2 className="px-5 pb-2 pt-5 text-[17px] tracking-[-0.02em] text-ink">Documents</h2>
            {credentials.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-muted">No documents issued yet.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {credentials.map((c) => (
                  <li key={c.credentialId} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[14.5px] text-ink">
                        {c.label}
                        <Pill tone={c.status === "issued" ? "good" : c.status === "revoked" ? "bad" : "warn"}>{c.status}</Pill>
                      </p>
                      <p className="font-mono text-[12.5px] text-muted">{c.credentialId}{c.courseTitle ? ` · ${c.courseTitle}` : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={`/verify/${c.credentialId}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] text-ink-soft ring-1 ring-line hover:bg-canvas">Verify page</a>
                      {c.status !== "revoked" ? (
                        <ConfirmDialog
                          trigger={<Button variant="danger" size="sm">Revoke</Button>}
                          title={`Revoke ${c.credentialId}?`}
                          body="The verify page will show this document as revoked, to everyone, permanently. Use this only if it was obtained dishonestly."
                          confirmLabel="Revoke document"
                          reason
                          onConfirm={(reason) => run(() => api(`/admin/credentials/${c.credentialId}/revoke`, { method: "POST", body: { reason } }), "Document revoked.")()}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-x-auto">
            <h2 className="px-5 pb-2 pt-5 text-[17px] tracking-[-0.02em] text-ink">Payments</h2>
            {payments.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-muted">No payments.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-[13.5px]">
                <thead className="border-y border-line bg-canvas text-[12px] text-muted">
                  <tr><th className="px-5 py-2 font-normal">Date</th><th className="px-3 py-2 text-right font-normal">Amount</th><th className="px-3 py-2 font-normal">Status</th><th className="px-5 py-2 font-normal">Razorpay ID</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-2.5">{istDate(p.paidAt ?? p.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{rupees(p.amountPaise)}</td>
                      <td className="px-3 py-2.5">
                        <Pill tone={p.status === "paid" ? "good" : p.status === "refunded" ? "bad" : "neutral"}>{p.status}</Pill>
                        {p.refundRequired ? <span className="ml-1.5"><Pill tone="warn">refund needed</Pill></span> : null}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-[12px] text-muted">{p.razorpayPaymentId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {submissions.length ? (
            <Card className="overflow-hidden">
              <h2 className="px-5 pb-2 pt-5 text-[17px] tracking-[-0.02em] text-ink">Project submissions</h2>
              <ul className="divide-y divide-line border-t border-line">
                {submissions.map((s) => (
                  <li key={s.id}>
                    <Link href={`${CLASSROOM_URL}/review/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafbfc]">
                      <span className="flex-1 truncate font-mono text-[12.5px] text-ink-soft">v{s.version} · {s.repoUrl.replace("https://github.com/", "")}</span>
                      <StatusPill status={s.status} />
                      <span className="text-[12.5px] text-muted">{s.totalPercent !== null ? `${s.totalPercent}%` : istDate(s.submittedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function RoleControl({ userId, role, onDone }: { userId: string; role: string; onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [next, setNext] = useState(role);
  if (user?.id === userId) return <Pill tone="info">{role} (you)</Pill>;
  return (
    <div className="flex items-center gap-2">
      <Select aria-label="Role" value={next} onChange={(e) => setNext(e.target.value)} className="h-10 w-36">
        <option value="student">Student</option>
        <option value="mentor">Mentor</option>
        <option value="admin">Admin</option>
      </Select>
      <ConfirmDialog
        trigger={<Button variant="outline" size="sm" disabled={next === role}>Change role</Button>}
        title={`Make this user ${next === "admin" ? "an admin" : `a ${next}`}?`}
        body={next === "admin" ? "Admins can change content, prices, refunds and revoke documents. They will be logged out and must log in again." : "They will be logged out and must log in again to get the new role."}
        confirmLabel="Change role"
        onConfirm={async () => {
          try {
            await api(`/admin/users/${userId}/role`, { method: "PATCH", body: { role: next } });
            toast("success", "Role changed.");
            onDone();
          } catch (e) {
            throw explain(e);
          }
        }}
      />
    </div>
  );
}
