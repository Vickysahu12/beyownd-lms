import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  BookOpen01Icon,
  Calendar03Icon,
  Certificate01Icon,
  CheckListIcon,
  File01Icon,
  FileValidationIcon,
  Github01Icon,
  Mail01Icon,
  MentoringIcon,
  QrCode01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { Logo } from "@/components/brand/logo";
import { getPublishedCourses } from "@/lib/catalog.server";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";

/*
 * 5.11 Footer, laid out like monday.com's: plain link column, icon columns,
 * coloured "document" tiles, then a dark banner card and the legal line.
 * Razorpay needs the policy links and business details. Legal entity is GrewDo
 * (business-model.md §7); placeholders until the owner supplies them (Y1, Y5).
 */

type FLink = { label: string; href: string; icon?: IconSvgElement; tile?: string };

const howItWorks: FLink[] = [
  { label: "Batches", href: "/#how-it-works", icon: Calendar03Icon },
  { label: "Lessons", href: "/#how-it-works", icon: BookOpen01Icon },
  { label: "Quizzes", href: "/#how-it-works", icon: CheckListIcon },
  { label: "Final project", href: "/#how-it-works", icon: Github01Icon },
  { label: "Mentor review", href: "/#how-it-works", icon: MentoringIcon },
  { label: "Verify a certificate", href: links.verify, icon: QrCode01Icon },
];

const documents: FLink[] = [
  { label: "Offer letter", href: "/#certificates", icon: File01Icon, tile: "bg-sky-3 text-brand-navy" },
  { label: "Completion certificate", href: "/#certificates", icon: Certificate01Icon, tile: "bg-butter text-[#6b5000]" },
  { label: "Completion letter", href: "/#certificates", icon: FileValidationIcon, tile: "bg-mint text-success-ink" },
];

const students: FLink[] = [
  { label: "Get started", href: links.signup },
  { label: "Log in", href: links.login },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "For colleges", href: "/for-colleges" },
  { label: "About", href: "/about" },
];

const legal: FLink[] = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund & Cancellation", href: "/refund-policy" },
  { label: "Delivery Policy", href: "/delivery-policy" },
  { label: "Contact Us", href: "/contact" },
];

export async function Footer() {
  const courses = await getPublishedCourses();
  const programs: FLink[] = courses.length
    ? courses.slice(0, 6).map((c) => ({ label: c.title, href: `/programs/${c.slug}` }))
    : [{ label: "All programs", href: links.programs }];

  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-[1320px] px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-[1.1fr_1fr_1.3fr_1.3fr_1fr]">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Logo />
            <Column links={[...programs, ...students]} className="mt-6" />
          </div>
          <Column title="How it works" links={howItWorks} />
          <div>
            <Column title="Your documents" links={documents} />
            <Column title="Talk to us" className="mt-10" links={[
              { label: "hello@beyownd.in", href: "mailto:hello@beyownd.in", icon: Mail01Icon },
              { label: "Send to parents", href: "/#pricing", icon: WhatsappIcon },
            ]} />
          </div>
          <Column title="Legal" links={legal} />
          <div>
            <p className="text-[17px] text-ink">Built by</p>
            <p className="mt-5 text-[15.5px] leading-relaxed text-muted">
              Beyownd is a product of <span className="text-ink-soft">GrewDo [LEGAL SUFFIX NEEDED]</span>
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">[REGISTERED ADDRESS NEEDED]</p>
          </div>
        </div>

        {/* Banner card */}
        <Link
          href={links.signup}
          className="group/banner mt-16 flex flex-col gap-6 rounded-[24px] bg-ink p-6 text-white transition-transform duration-200 ease-out active:scale-[0.99] sm:flex-row sm:items-center sm:p-7 lg:max-w-[760px]"
        >
          <span className="min-w-0">
            <span className="block text-[32px] font-light leading-none tracking-[-0.04em] sm:text-[38px]">Module 1 is free</span>
            <span className="mt-2 block text-[14.5px] text-white/65">Preview a real lesson before you pay anything.</span>
          </span>
          <span className="flex items-center gap-2 sm:ml-auto">
            {["bg-lavender", "bg-sky-2", "bg-mint"].map((tile, i) => (
              <span
                key={tile}
                aria-hidden
                className={cn(
                  "hidden size-12 rounded-2xl transition-transform duration-300 ease-out sm:block",
                  tile,
                  i === 0 && "group-hover/banner:-rotate-12",
                  i === 1 && "rounded-full group-hover/banner:-translate-y-1",
                  i === 2 && "group-hover/banner:rotate-12",
                )}
              />
            ))}
            <span className="inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-full bg-butter px-6 text-[16px] text-ink">
              Start free
              <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/banner:translate-x-1" />
            </span>
          </span>
        </Link>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[13.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 GrewDo. All rights reserved.</p>
          <p>Made for final-year students across India.</p>
        </div>
      </div>
    </footer>
  );
}

function Column({ title, links: items, className }: { title?: string; links: FLink[]; className?: string }) {
  return (
    <nav aria-label={title ?? "Beyownd"} className={className}>
      {title ? <p className="mb-4 text-[17px] text-ink">{title}</p> : null}
      <ul className="space-y-1">
        {items.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="group/fl inline-flex min-h-10 items-center gap-3 text-[15px] text-muted transition-colors duration-150 hover:text-ink">
              {l.icon ? (
                <span
                  className={cn(
                    "grid shrink-0 place-items-center transition-transform duration-200 ease-out group-hover/fl:-translate-y-0.5",
                    l.tile ? cn("size-7 rounded-lg", l.tile) : "size-5 text-ink-soft",
                  )}
                >
                  <HugeiconsIcon icon={l.icon} size={l.tile ? 15 : 19} strokeWidth={1.6} aria-hidden />
                </span>
              ) : null}
              <span className="link-grow">{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
