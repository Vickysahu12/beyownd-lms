import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/marketing/page-header";
import { InView } from "@/components/motion/in-view";
import { LEGAL_PARTY } from "@/lib/legal";
import { JsonLd, breadcrumbs, pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, links } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About Beyownd",
  description: "Why Beyownd exists: final-year students need a real, verifiable internship. Project-based virtual internship programs with real batch dates, by GrewDo.",
  path: "/about",
});

/* PAGES.md §3.7. No invented team members or numbers; the founder note comes from the owner. */
const principles = [
  { t: "Real work, real dates", d: "Every program runs as a batch with fixed start and end dates, and ends with a project a mentor reviews. The dates on your letters are the dates you actually studied." },
  { t: "Earned, never bought", d: "Paying gets you in. The certificate comes only after every module is passed and the project is approved." },
  { t: "Checkable by anyone", d: "Each document has an ID and QR code. A TPO or recruiter can confirm it in seconds, without emailing us." },
  { t: "Priced for students", d: "One fair, one-time price, payable by UPI. No upsells to unlock the certificate." },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "About", href: "/about" }]}
        title={<>An internship you can <span className="text-brand">stand behind</span></>}
        lead="Most colleges ask final-year students for an internship. Many students, especially outside big cities, can't find one, and end up with a certificate that proves nothing. Beyownd exists to fix that."
      />

      <InView as="section" aria-labelledby="why-title" className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <h2 id="why-title" className="reveal display text-[34px] leading-[1.1] text-ink sm:text-[44px]">What we <span className="text-brand">believe</span></h2>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
            {principles.map((p, i) => (
              <li key={p.t} className="reveal" style={{ "--i": i + 1 } as React.CSSProperties}>
                <h3 className="text-[19px] tracking-[-0.02em] text-ink">{p.t}</h3>
                <p className="mt-2 text-[15.5px] leading-[1.65] text-ink-soft">{p.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </InView>

      <InView as="section" aria-labelledby="how-title" className="mx-auto mt-24 max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] bg-canvas p-7 sm:p-10">
          <h2 id="how-title" className="reveal text-[26px] tracking-[-0.02em] text-ink sm:text-[30px]">How it works, briefly</h2>
          <ol className="mt-6 grid grid-cols-1 gap-5 text-[15.5px] leading-[1.6] text-ink-soft sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Pick a program and a batch. You get an offer letter right away.",
              "Learn module by module. A quiz ends each one; pass it to unlock the next.",
              "Build the final project. A mentor reviews it and gives feedback.",
              "After the batch ends, download your certificate and completion letter.",
            ].map((s, i) => (
              <li key={s} className="reveal flex gap-3" style={{ "--i": i + 1 } as React.CSSProperties}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[14px] font-medium text-brand ring-1 ring-line">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <Link href={links.programs} className="reveal mt-8 inline-flex h-11 items-center rounded-full bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-hover">See programs</Link>
        </div>
      </InView>

      <InView as="section" aria-labelledby="who-title" className="mx-auto mt-24 max-w-[1200px] px-4 pb-24 sm:px-6 lg:px-8">
        <h2 id="who-title" className="reveal text-[26px] tracking-[-0.02em] text-ink sm:text-[30px]">Who runs it</h2>
        <p className="reveal mt-3 max-w-[44rem] text-[16.5px] leading-[1.65] text-ink-soft" style={{ "--i": 1 } as React.CSSProperties}>
          Beyownd is a product of <b className="font-medium text-ink">{LEGAL_PARTY}</b>, which issues every offer letter and certificate. Questions about the company or a partnership: <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline-offset-4 hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </InView>
    </>
  );
}
