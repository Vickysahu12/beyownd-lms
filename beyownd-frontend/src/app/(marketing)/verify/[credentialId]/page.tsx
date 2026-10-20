import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Cancel01Icon, Clock01Icon, SearchRemoveIcon } from "@hugeicons/core-free-icons";
import { ResultActions } from "@/components/verify/result-actions";
import { VerifyForm } from "@/components/verify/verify-form";
import { formatFullDate } from "@/lib/catalog";
import { verifyCredential, type VerifiedCredential } from "@/lib/verify.server";
import { cn } from "@/lib/utils";

/*
 * PAGES.md §3.6: rendered per request (never cached, a revoked document must
 * never look valid), noindex/nofollow, and no personal data in metadata.
 */
export const metadata: Metadata = {
  title: "Certificate verification",
  description: "Verification result for a Beyownd document.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: { title: "Certificate verification | Beyownd", description: "Verification result for a Beyownd document." },
};

export default function VerifyResultPage(props: PageProps<"/verify/[credentialId]">) {
  return (
    <div className="mx-auto max-w-[820px] px-4 pb-24 pt-[112px] sm:px-6 lg:pt-[140px]">
      <Suspense fallback={<ResultSkeleton />}>
        <Result params={props.params} />
      </Suspense>
    </div>
  );
}

async function Result({ params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  const id = decodeURIComponent(credentialId).toUpperCase();
  const r = await verifyCredential(id);

  if (r.kind === "not_found") {
    return (
      <Panel tone="neutral" icon={SearchRemoveIcon} title="No document found with this ID" id={id}>
        <p className="text-[16px] leading-[1.6] text-ink-soft">Please check the ID on the document. A few tips:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
          <li>IDs look like <span className="font-mono">BYD-26-7KQ4-M9XA</span>.</li>
          <li>IDs never use 0, 1, O, I or L, so if you see one of those, it&apos;s probably a different character.</li>
          <li>Scanning the QR code on the document opens the right page directly.</li>
        </ul>
        <div className="mt-6"><VerifyForm defaultValue={id} size="md" /></div>
      </Panel>
    );
  }

  if (r.kind === "error") {
    return (
      <Panel tone="neutral" icon={Alert02Icon} title="We couldn't check this right now" id={id}>
        <p className="text-[16px] leading-[1.6] text-ink-soft">The verification service didn&apos;t respond. Please refresh in a minute. This doesn&apos;t mean the document is invalid.</p>
      </Panel>
    );
  }

  const c = r.credential;
  if (c.status === "generating") {
    return (
      <Panel tone="neutral" icon={Clock01Icon} title="This document is being issued" id={c.credentialId}>
        <p className="text-[16px] leading-[1.6] text-ink-soft">It has been created and the PDF is being prepared. Please check again in a few minutes.</p>
        <Details c={c} />
      </Panel>
    );
  }

  if (c.status === "revoked") {
    return (
      <Panel tone="revoked" icon={Cancel01Icon} title="This document has been revoked" id={c.credentialId}>
        <p className="text-[16px] leading-[1.6] text-[#7a1d2a]">
          It is no longer valid{c.revokedAt ? ` since ${formatFullDate(c.revokedAt)}` : ""}. Please do not accept it as proof of completion.
        </p>
        <Details c={c} muted />
        <div className="mt-8"><ResultActions /></div>
      </Panel>
    );
  }

  return (
    <Panel tone="valid" title="Verified" id={c.credentialId} seal>
      <p className="text-[16px] leading-[1.6] text-success-ink">This {c.label.toLowerCase()} was issued by Beyownd and is valid.</p>
      <Details c={c} />
      <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
        Issued by {c.issuedBy} for the {c.programName}.
      </p>
      <div className="mt-8"><ResultActions /></div>
    </Panel>
  );
}

function Panel({
  tone,
  icon,
  title,
  id,
  seal,
  children,
}: {
  tone: "valid" | "revoked" | "neutral";
  icon?: typeof Clock01Icon;
  title: string;
  id: string;
  seal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="result-title"
      className={cn(
        "rise rounded-[32px] p-6 ring-1 sm:p-10",
        tone === "valid" && "bg-mint ring-[#9fe3bf]",
        tone === "revoked" && "bg-[#fde8eb] ring-[#f3b4bf]",
        tone === "neutral" && "bg-canvas ring-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        {seal ? (
          <span className="grid size-16 place-items-center rounded-full bg-st-done text-white shadow-[0_10px_30px_-10px_rgb(0_184_107/0.8)]">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden>
              <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : icon ? (
          <span className={cn("grid size-16 place-items-center rounded-full", tone === "revoked" ? "bg-st-stuck text-white" : "bg-white text-ink-soft")}>
            <HugeiconsIcon icon={icon} size={28} strokeWidth={1.8} aria-hidden />
          </span>
        ) : null}
        <div>
          <p className="font-mono text-[13px] text-muted">{id}</p>
          <h1 id="result-title" className="display mt-1 text-[36px] leading-[1.05] text-ink sm:text-[48px]">{title}</h1>
        </div>
      </div>
      <div className="mt-6">{children}</div>
      <p className="mt-8 text-[13.5px] text-muted print:hidden">
        Checked just now. <Link href="/verify" className="link-grow text-ink-soft">Verify another document</Link>
      </p>
    </section>
  );
}

function Details({ c, muted }: { c: VerifiedCredential; muted?: boolean }) {
  const rows: [string, string | null][] = [
    ["Document", c.label],
    ["Issued to", c.studentName],
    ["College", c.collegeName],
    ["Program", c.courseTitle],
    ["Batch", `${c.cohortName} · ${formatFullDate(c.startDate)} to ${formatFullDate(c.endDate)}`],
    ["Issued on", c.issuedAt ? formatFullDate(c.issuedAt) : null],
  ];
  return (
    <dl className={cn("mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-2", muted && "opacity-75")}>
      {rows
        .filter(([, v]) => v)
        .map(([k, v], i, all) => (
          <div key={k} className={cn("bg-white px-4 py-3.5", all.length % 2 === 1 && i === all.length - 1 && "sm:col-span-2")}>
            <dt className="text-[12.5px] text-muted">{k}</dt>
            <dd className="mt-0.5 text-[16px] text-ink">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

function ResultSkeleton() {
  return (
    <div aria-busy aria-label="Checking the document" className="rounded-[32px] bg-canvas p-6 sm:p-10">
      <div className="shimmer relative h-16 w-16 overflow-hidden rounded-full bg-white" />
      <div className="shimmer relative mt-6 h-10 w-2/3 overflow-hidden rounded-xl bg-white" />
      <div className="shimmer relative mt-6 h-40 overflow-hidden rounded-2xl bg-white" />
    </div>
  );
}
