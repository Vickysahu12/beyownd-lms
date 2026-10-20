import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  CheckListIcon,
  Mail01Icon,
  MentoringIcon,
  QrCode01Icon,
  SecurityCheckIcon,
  Search01Icon,
  Building03Icon,
} from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/marketing/page-header";
import { VerifyForm } from "@/components/verify/verify-form";
import { InView } from "@/components/motion/in-view";
import { JsonLd, breadcrumbs, pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Verify Beyownd Internship Certificates | For Colleges",
  description:
    "For TPOs, HODs and recruiters: what a Beyownd virtual internship involves, how to verify an offer letter or certificate in seconds, and who issues them.",
  path: "/for-colleges",
});

const facts: { icon: IconSvgElement; t: string; d: string }[] = [
  { icon: Calendar03Icon, t: "Real batch dates", d: "Each student joins a batch with fixed start and end dates. Paid lessons open only on the start date." },
  { icon: CheckListIcon, t: "Assessed module by module", d: "A quiz ends every module (pass mark 60%). The next module stays locked until it's passed." },
  { icon: MentoringIcon, t: "A reviewed final project", d: "Students submit a project (GitHub link). A mentor approves it or requests changes." },
  { icon: SecurityCheckIcon, t: "Issued only when earned", d: "The certificate is issued after the batch ends and the project is approved. Never on payment alone." },
];

const steps = [
  { t: "Find the ID", d: "It's printed on every document, under the QR code, e.g. BYD-26-7KQ4-M9XA." },
  { t: "Scan or type it", d: "Scan the QR code, or enter the ID at beyownd.in/verify. No login needed." },
  { t: "Check the result", d: "You'll see the student's name, college, program, batch dates and the document's status." },
];

const docs = [
  { t: "Offer letter", d: "Issued when a student joins a batch. States the program and batch dates.", img: "/illustrations/doc-offer.svg", tint: "bg-sky-3" },
  { t: "Completion certificate", d: "Issued after the batch ends and the project is approved. Carries a QR code.", img: "/illustrations/doc-certificate.svg", tint: "bg-butter" },
  { t: "Completion letter", d: "Describes the program and the work completed, for the student's college file.", img: "/illustrations/doc-letter.svg", tint: "bg-mint" },
];

export default function ForCollegesPage() {
  return (
    <>
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "For colleges", path: "/for-colleges" }])} />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "For colleges", href: "/for-colleges" }]}
        title={<>For colleges, TPOs and <span className="text-brand">recruiters</span></>}
        lead="Beyownd runs project-based virtual internship programs for final-year students. Here's exactly what a student does, and how you can check any document they show you."
      />

      <InView as="section" aria-labelledby="what-title" className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 id="what-title" className="reveal display text-[34px] text-ink sm:text-[44px]">What the program <span className="text-brand">is</span></h2>
        <p className="reveal mt-4 max-w-[44rem] text-[17px] leading-[1.6] text-ink-soft" style={{ "--i": 1 } as React.CSSProperties}>
          It is a <strong className="font-medium text-ink">virtual internship program</strong>, delivered online. It is not an on-site job or a company
          placement, and our documents say so plainly.
        </p>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f, i) => (
            <li key={f.t} className="reveal lift group rounded-[24px] bg-white p-6 ring-1 ring-line" style={{ "--i": i + 2 } as React.CSSProperties}>
              <HugeiconsIcon icon={f.icon} size={24} strokeWidth={1.6} aria-hidden className="text-brand transition-transform duration-300 group-hover:-rotate-6" />
              <h3 className="mt-4 text-[17px] tracking-[-0.02em] text-ink">{f.t}</h3>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-muted">{f.d}</p>
            </li>
          ))}
        </ul>
      </InView>

      <InView as="section" aria-labelledby="verify-steps" className="mx-auto mt-20 max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="reveal grid grid-cols-1 gap-10 rounded-[32px] bg-canvas p-6 sm:p-10 lg:grid-cols-2 lg:gap-14 lg:p-14">
          <div>
            <h2 id="verify-steps" className="display text-[34px] text-ink sm:text-[44px]">Verify in <span className="text-brand">seconds</span></h2>
            <ol className="mt-8 space-y-6">
              {steps.map((s, i) => (
                <li key={s.t} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white font-mono text-[14px] text-brand ring-1 ring-line">{i + 1}</span>
                  <span>
                    <span className="block text-[17px] tracking-[-0.02em] text-ink">{s.t}</span>
                    <span className="mt-1 block text-[15px] leading-[1.6] text-muted">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="self-center rounded-[24px] bg-white p-5 shadow-[var(--shadow-board)] sm:p-7">
            <p className="mb-4 flex items-center gap-2 text-[15px] text-ink">
              <HugeiconsIcon icon={QrCode01Icon} size={18} strokeWidth={1.7} aria-hidden className="text-brand" />
              Check a document now
            </p>
            <VerifyForm size="md" />
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              A revoked document shows as revoked with its date. Personal details are shown only on the verify page, never in search results.
            </p>
          </div>
        </div>
      </InView>

      <InView as="section" aria-labelledby="docs-title" className="mx-auto mt-20 max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 id="docs-title" className="reveal display text-[34px] text-ink sm:text-[44px]">The three <span className="text-brand">documents</span></h2>
        <p className="reveal mt-3 text-[14px] text-muted" style={{ "--i": 1 } as React.CSSProperties}>Illustrations of the layout. Every real document can be checked on its verify page.</p>
        <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {docs.map((d, i) => (
            <li key={d.t} className="reveal lift group rounded-[24px] bg-white p-2 ring-1 ring-line" style={{ "--i": i + 2 } as React.CSSProperties}>
              <div className={cn("overflow-hidden rounded-[18px] p-6", d.tint)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size SVG illustration */}
                <img src={d.img} alt={`Illustration of a Beyownd ${d.t.toLowerCase()}`} width={240} height={168} loading="lazy" className="mx-auto w-full max-w-[280px] rounded-xl shadow-[var(--shadow-float)] transition-transform duration-500 ease-out group-hover:-rotate-2 group-hover:scale-[1.03]" />
              </div>
              <div className="p-4">
                <h3 className="text-[18px] tracking-[-0.02em] text-ink">{d.t}</h3>
                <p className="mt-1.5 text-[15px] leading-[1.6] text-muted">{d.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </InView>

      <section aria-labelledby="issuer-title" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 rounded-[28px] bg-ink p-7 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 id="issuer-title" className="flex items-center gap-3 text-[26px] font-light tracking-[-0.03em] sm:text-[32px]">
              <HugeiconsIcon icon={Building03Icon} size={26} strokeWidth={1.5} aria-hidden />
              Who issues these documents
            </h2>
            <p className="mt-3 max-w-[44rem] text-[15.5px] leading-[1.6] text-white/75">
              Documents are issued by <span className="text-white">GrewDo [LEGAL NAME AND REGISTRATION NO. NEEDED]</span> for the Beyownd Virtual
              Internship Program. Beyownd is a product of GrewDo. Registered address: [ADDRESS NEEDED].
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`mailto:${CONTACT_EMAIL}?subject=Verification%20query`} className="group/btn inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15.5px] text-ink transition-transform active:scale-[0.97]">
              <HugeiconsIcon icon={Mail01Icon} size={17} strokeWidth={1.8} aria-hidden />
              Email a verification query
            </a>
            <Link href="/verify" className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15.5px] text-white ring-1 ring-white/30 transition-colors hover:bg-white/10">
              <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} aria-hidden />
              Open the verify page
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
