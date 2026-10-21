import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { FaqList } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { faqGroups } from "@/lib/faq-data";
import { JsonLd, breadcrumbs, pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "FAQ: Virtual Internships, Certificates & Payments",
  description: "Straight answers about Beyownd virtual internship programs: how batches work, when certificates are issued, how verification works, payments and refunds.",
  path: "/faq",
});

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function FaqPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqGroups.flatMap((g) =>
      g.items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.link ? `${f.a} ${f.link.text}` : f.a } })),
    ),
  };
  return (
    <>
      <JsonLd data={[breadcrumbs([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]), faqLd]} />
      <PageHeader crumbs={[{ name: "Home", href: "/" }, { name: "FAQ", href: "/faq" }]} title={<>Questions, <span className="text-brand">answered</span></>} lead="Straight answers about how the program, documents and payments work." />
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <nav aria-label="Topics" className="lg:sticky lg:top-28 lg:h-fit">
          <ol className="flex flex-wrap gap-2 lg:grid lg:gap-1.5">
            {faqGroups.map((g) => (
              <li key={g.title}>
                <a href={`#${slug(g.title)}`} className="inline-flex rounded-full bg-canvas px-3.5 py-2 text-[14px] text-ink-soft hover:text-ink lg:bg-transparent lg:p-0">{g.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="grid max-w-[52rem] gap-14">
          {faqGroups.map((g) => (
            <section key={g.title} id={slug(g.title)} aria-labelledby={`${slug(g.title)}-h`} className="scroll-mt-28">
              <h2 id={`${slug(g.title)}-h`} className="mb-2 text-[26px] tracking-[-0.02em] text-ink">{g.title}</h2>
              <FaqList items={g.items} firstOpen={false} />
            </section>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex min-h-11 items-center gap-2 text-[15px] text-ink-soft hover:text-ink">
            <HugeiconsIcon icon={Mail01Icon} size={18} strokeWidth={1.6} aria-hidden />
            <span className="link-grow">Didn&apos;t find your answer? Email {CONTACT_EMAIL}</span>
          </a>
        </div>
      </div>
    </>
  );
}
