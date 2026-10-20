import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { QrCode01Icon, SecurityCheckIcon, UserCheck01Icon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/marketing/page-header";
import { VerifyForm } from "@/components/verify/verify-form";
import { JsonLd, breadcrumbs, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Verify a Beyownd Certificate",
  description:
    "Check if a Beyownd offer letter, internship certificate or completion letter is genuine. Enter the credential ID or scan the QR code. No login needed.",
  path: "/verify",
});

const points: { icon: IconSvgElement; t: string; d: string }[] = [
  { icon: QrCode01Icon, t: "Scan or type", d: "Every document has a unique ID and a QR code that opens its page directly." },
  { icon: UserCheck01Icon, t: "No login, no emails", d: "Anyone can check it: colleges, TPOs, recruiters and parents." },
  { icon: SecurityCheckIcon, t: "Always current", d: "If a document has been revoked, the page says so clearly." },
];

export default function VerifyPage() {
  return (
    <>
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Verify", path: "/verify" }])} />
      <PageHeader
        align="center"
        crumbs={[{ name: "Home", href: "/" }, { name: "Verify", href: "/verify" }]}
        title={<>Verify a <span className="text-brand">certificate</span></>}
        lead="Enter the ID printed on a Beyownd document to see who it was issued to, for which program and batch, and whether it is still valid."
      >
        <div className="mx-auto max-w-[620px] rounded-[28px] bg-canvas p-4 text-left sm:p-6">
          <VerifyForm />
        </div>
      </PageHeader>
      <section aria-label="How verification works" className="mx-auto max-w-[1000px] px-4 pb-24 sm:px-6">
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {points.map((p) => (
            <li key={p.t} className="lift group rounded-[24px] bg-white p-6 ring-1 ring-line">
              <HugeiconsIcon icon={p.icon} size={24} strokeWidth={1.6} aria-hidden className="text-brand transition-transform duration-300 group-hover:-rotate-6" />
              <h2 className="mt-4 text-[18px] tracking-[-0.02em] text-ink">{p.t}</h2>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-muted">{p.d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-[14px] text-muted">
          Verifying for a college? <Link href="/for-colleges" className="link-grow text-brand">Read how our documents work</Link>
        </p>
      </section>
    </>
  );
}
