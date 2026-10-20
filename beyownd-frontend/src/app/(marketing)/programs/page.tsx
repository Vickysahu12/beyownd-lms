import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, BookOpen01Icon, Certificate01Icon, CheckListIcon, Github01Icon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/marketing/page-header";
import { ProgramCard, ProgramsEmpty } from "@/components/marketing/program-card";
import { InView } from "@/components/motion/in-view";
import { getPublishedCourses } from "@/lib/catalog.server";
import { formatRupees } from "@/lib/catalog";
import { JsonLd, absolute, breadcrumbs, organization, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Virtual Internship Programs for College Students",
  description:
    "Browse Beyownd's project-based virtual internship programs. Real batch dates, a quiz per module, a mentor-reviewed project and a certificate anyone can verify.",
  path: "/programs",
});

const steps = [
  { icon: BookOpen01Icon, label: "Learn module by module" },
  { icon: CheckListIcon, label: "Pass a quiz per module" },
  { icon: Github01Icon, label: "Build a reviewed project" },
  { icon: Certificate01Icon, label: "Get verifiable documents" },
];

const faqs = [
  ["Do I need prior experience?", "No. Programs are beginner-friendly and Module 1 is free to preview before you pay."],
  ["When do I get the certificate?", "After your batch end date, once every module is done and a mentor approves your project."],
  ["Will my college accept it?", "Every document can be verified online. Requirements differ, so check with your college or TPO."],
];

export default async function ProgramsPage() {
  const courses = await getPublishedCourses();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: courses.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Course",
                name: c.title,
                description: c.tagline ?? c.title,
                url: absolute(`/programs/${c.slug}`),
                provider: organization,
                offers: { "@type": "Offer", price: c.fromPricePaise / 100, priceCurrency: "INR", category: "Paid" },
              },
            })),
          },
          breadcrumbs([{ name: "Home", path: "/" }, { name: "Programs", path: "/programs" }]),
        ]}
      />

      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Programs", href: "/programs" }]}
        title={<>Virtual internship <span className="text-brand">programs</span></>}
        lead="Every program runs in a batch with real start and end dates. You learn module by module, pass a quiz for each, build a project a mentor reviews, and get documents anyone can verify."
      />

      <InView className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {courses.length === 0 ? (
          <div className="reveal">
            <ProgramsEmpty title="New programs are being prepared" />
          </div>
        ) : (
          <>
            <p className="reveal text-[14px] text-muted">
              {courses.length} {courses.length === 1 ? "program" : "programs"} · from{" "}
              {formatRupees(Math.min(...courses.map((c) => c.fromPricePaise)))}
            </p>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c, i) => (
                <li key={c.id} className="reveal" style={{ "--i": i + 1 } as React.CSSProperties}>
                  <ProgramCard course={c} headingLevel="h2" />
                </li>
              ))}
            </ul>
          </>
        )}
      </InView>

      <InView as="section" className="mx-auto mt-20 max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="reveal rounded-[32px] bg-canvas p-6 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="display text-[32px] text-ink sm:text-[40px]">
              Every program works the <span className="text-brand">same way</span>
            </h2>
            <Link href="/#how-it-works" className="group/link inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[16px] text-ink">
              <span className="link-grow">See how it works</span>
              <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/link:translate-x-1" />
            </Link>
          </div>
          <ol className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label} className="lift group flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-wash text-brand transition-transform duration-300 group-hover:-rotate-6">
                  <HugeiconsIcon icon={s.icon} size={19} strokeWidth={1.6} aria-hidden />
                </span>
                <span className="text-[14.5px] leading-snug text-ink">
                  <span className="mr-1 font-mono text-[12px] text-muted">0{i + 1}</span>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </InView>

      <section aria-labelledby="programs-faq" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
        <h2 id="programs-faq" className="display text-[32px] text-ink sm:text-[40px]">Before you pick</h2>
        <dl className="mt-8 grid gap-6 md:grid-cols-3">
          {faqs.map(([q, a]) => (
            <div key={q} className="border-t border-line pt-5">
              <dt className="text-[17px] tracking-[-0.02em] text-ink">{q}</dt>
              <dd className="mt-2 text-[15px] leading-[1.6] text-muted">{a}</dd>
            </div>
          ))}
        </dl>
        <Link href="/faq" className="group/link mt-8 inline-flex min-h-11 items-center gap-1.5 text-[16px] text-brand">
          <span className="link-grow">Read the full FAQ</span>
          <HugeiconsIcon icon={ArrowRight02Icon} size={17} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/link:translate-x-1" />
        </Link>
      </section>
    </>
  );
}
