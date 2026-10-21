import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/marketing/page-header";
import { JsonLd, breadcrumbs } from "@/lib/seo";
import { LEGAL_PARTY } from "@/lib/legal";
import { CONTACT_EMAIL } from "@/lib/site";

/*
 * Policy page layout (PAGES.md §3.10): table of contents, anchors per
 * section, last-updated date. With `draft`, a clearly marked placeholder
 * stands in for the owner's final text; nothing legal is invented.
 */
export type LegalSection = { id: string; title: string; body: React.ReactNode };

export function LegalPage({
  path,
  title,
  lead,
  sections,
  draft,
  updated,
}: {
  path: string;
  title: string;
  lead: string;
  sections: LegalSection[];
  draft?: { covers: string[] };
  updated?: string;
}) {
  return (
    <>
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: title, path }])} />
      <PageHeader crumbs={[{ name: "Home", href: "/" }, { name: title, href: path }]} title={title} lead={lead} />
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        {sections.length > 1 ? (
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:h-fit">
            <p className="text-[13px] text-muted">On this page</p>
            <ol className="mt-2 grid gap-1.5 text-[14.5px]">
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="link-grow text-ink-soft hover:text-ink">{s.title}</a></li>
              ))}
            </ol>
          </nav>
        ) : <div className="hidden lg:block" />}

        <div className="max-w-[46rem]">
          {draft ? (
            <div role="note" className="mb-10 rounded-[20px] bg-butter p-5 text-[15px] leading-relaxed text-[#5c4700]">
              <p className="flex items-center gap-2 font-medium">
                <HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.8} aria-hidden /> Final text coming soon
              </p>
              <p className="mt-1.5">
                {LEGAL_PARTY} is finalising this policy. It will cover: {draft.covers.join(", ")}. Until it&apos;s published, email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> with any question and we&apos;ll answer in writing.
              </p>
            </div>
          ) : null}

          <div className="grid gap-10">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
                <h2 id={`${s.id}-h`} className="text-[24px] tracking-[-0.02em] text-ink">{s.title}</h2>
                <div className="mt-3 grid gap-3 text-[16px] leading-[1.7] text-ink-soft [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc [&_ul]:grid [&_ul]:gap-1.5">{s.body}</div>
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-line pt-5 text-[13.5px] text-muted">
            {updated ? `Last updated ${updated}. ` : ""}Beyownd is a product of {LEGAL_PARTY}. Questions: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> · <Link href="/contact" className="underline">Contact</Link>
          </p>
        </div>
      </div>
    </>
  );
}
