import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Building03Icon, Mail01Icon, QrCode01Icon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/marketing/page-header";
import { LEGAL_PARTY } from "@/lib/legal";
import { JsonLd, breadcrumbs, pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact Beyownd",
  description: "Email Beyownd about programs, payments or a document. Colleges and recruiters can verify any Beyownd document online without contacting us.",
  path: "/contact",
});

/*
 * PAGES.md §3.9. No contact form at launch (no backend endpoint). WhatsApp
 * number and registered address come from the owner (REMAINING Y6); they're
 * left out rather than shown as fake values.
 */
const cards: { icon: IconSvgElement; t: string; d: React.ReactNode }[] = [
  {
    icon: Mail01Icon,
    t: "Email",
    d: (
      <>
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-[18px] text-brand underline-offset-4 hover:underline">{CONTACT_EMAIL}</a>
        <span className="mt-1 block">Programs, payments, your account or a document. If it&apos;s about a payment, include your payment ID.</span>
      </>
    ),
  },
  {
    icon: QrCode01Icon,
    t: "Checking a certificate?",
    d: (
      <>
        You don&apos;t need to contact us. Enter the ID printed on the document at <Link href="/verify" className="text-brand underline-offset-4 hover:underline">beyownd.in/verify</Link>.{" "}
        <Link href="/for-colleges" className="text-brand underline-offset-4 hover:underline">More for colleges</Link>
      </>
    ),
  },
  {
    icon: Building03Icon,
    t: "Company",
    d: <>Beyownd is a product of {LEGAL_PARTY}. Registered details are printed on every offer letter and certificate.</>,
  },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])} />
      <PageHeader crumbs={[{ name: "Home", href: "/" }, { name: "Contact", href: "/contact" }]} title={<>Talk to <span className="text-brand">us</span></>} lead="Questions before or after you enroll? Email us and we'll reply in writing." />
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-4 pb-24 sm:px-6 md:grid-cols-3 lg:px-8">
        {cards.map((c) => (
          <section key={c.t} className="rounded-[24px] bg-white p-6 ring-1 ring-line">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-wash text-brand"><HugeiconsIcon icon={c.icon} size={20} strokeWidth={1.6} aria-hidden /></span>
            <h2 className="mt-4 text-[19px] tracking-[-0.02em] text-ink">{c.t}</h2>
            <div className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.d}</div>
          </section>
        ))}
      </div>
    </>
  );
}
