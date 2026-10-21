"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Download04Icon, File02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { DocPill } from "@/components/app/doc-pill";
import { useToast } from "@/components/app/toast";
import { Button, Card, EmptyState, ErrorState, PageTitle, Skeleton, istDate } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { MARKETING_URL, SITE_URL } from "@/lib/site";
import type { MyCredential } from "@/lib/student-types";

/*
 * My documents. Download asks the API for a short-lived signed link each
 * time (never stored). "Copy verify link" gives the public page to send to
 * a college. Documents being generated refresh on their own.
 */
export default function DocumentsPage() {
  const q = useQuery({
    queryKey: ["my-credentials"],
    queryFn: () => api<{ credentials: MyCredential[] }>("/credentials"),
    refetchInterval: (query) => (query.state.data?.credentials.some((c) => c.status === "generating") ? 10_000 : false),
  });
  const list = q.data?.credentials ?? [];

  return (
    <>
      <PageTitle title="Documents" sub="Offer letter, certificate and completion letter. Each has its own public verify link." />
      {q.isPending ? (
        <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="No documents yet" body="Your offer letter appears here right after you enroll. The certificate and completion letter come after you finish the program and the batch ends.">
          <Link href={`${MARKETING_URL}/programs`} className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">See programs</Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {list.map((c) => <DocRow key={c.credentialId} c={c} />)}
        </ul>
      )}
    </>
  );
}

function DocRow({ c }: { c: MyCredential }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const verifyUrl = `${SITE_URL}/verify/${c.credentialId}`;

  const download = async () => {
    setBusy(true);
    try {
      const r = await api<{ url: string }>(`/credentials/${encodeURIComponent(c.credentialId)}/download`);
      window.location.assign(r.url);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      toast("error", code === "CREDENTIAL_NOT_READY" ? "This document is still being prepared. Try again in a minute." : code === "CREDENTIAL_REVOKED" ? "This document has been revoked." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("error", "Couldn't copy. Long-press the ID to copy it instead.");
    }
  };

  return (
    <li>
      <Card className="flex flex-wrap items-start gap-4 p-5 sm:flex-nowrap sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-wash text-brand"><HugeiconsIcon icon={File02Icon} size={20} strokeWidth={1.6} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[16px] text-ink">{c.label} <DocPill status={c.status} /></p>
          <p className="mt-0.5 text-[13px] text-muted">{c.courseTitle} · {c.cohortName}</p>
          <p className="mt-1 select-all font-mono text-[12.5px] text-ink-soft">{c.credentialId}</p>
          {c.status === "revoked" ? <p className="mt-1 text-[13px] text-[#a3263a]">Revoked on {istDate(c.revokedAt)}</p> : c.status === "issued" ? <p className="mt-1 text-[12.5px] text-muted">Issued {istDate(c.issuedAt)}</p> : <p className="mt-1 text-[12.5px] text-muted">Being prepared. This page updates by itself.</p>}
        </div>
        {c.status === "issued" ? (
          <div className="flex w-full gap-2 sm:w-auto sm:flex-col sm:items-stretch">
            <Button onClick={download} loading={busy} size="sm" className="flex-1"><HugeiconsIcon icon={Download04Icon} size={15} strokeWidth={1.8} aria-hidden /> Download PDF</Button>
            <Button onClick={copy} variant="outline" size="sm" className="flex-1" aria-live="polite">
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={15} strokeWidth={1.8} aria-hidden /> {copied ? "Copied" : "Copy verify link"}
            </Button>
          </div>
        ) : null}
      </Card>
    </li>
  );
}
