import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, Calendar03Icon, QrCode01Icon, SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { coverFor, formatBatchDate, formatRupees, type CourseCard } from "@/lib/catalog";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";

/*
 * Dropdown panels for the desktop navigation. Every tile is Beyownd's own:
 * real programs from the API (or an honest empty state), and our three documents.
 */

const docs = [
  {
    title: "Offer letter",
    body: "Issued when you join a batch, with its real start and end dates.",
    img: "/illustrations/doc-offer.svg",
  },
  {
    title: "Completion certificate",
    body: "Issued after your batch ends and a mentor approves your project.",
    img: "/illustrations/doc-certificate.svg",
  },
  {
    title: "Completion letter",
    body: "Describes the work you did, ready for your college file.",
    img: "/illustrations/doc-letter.svg",
  },
];

function Thumb({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-xl ring-1 ring-[rgb(24_58_90/0.1)] shadow-[0_6px_16px_-8px_rgb(24_58_90/0.35)]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small SVG/remote thumbnails, fixed box */}
      <img
        src={src}
        alt=""
        width={240}
        height={168}
        loading="lazy"
        className="size-full object-cover transition-transform duration-500 ease-out group-hover/row:scale-[1.06]"
      />
    </span>
  );
}

export function ProgramsPanel({ courses }: { courses: CourseCard[] }) {
  const shown = courses.slice(0, 4);
  return (
    <div className={cn("grid grid-cols-[1fr_240px] gap-2 p-2", shown.length ? "w-[780px]" : "w-[640px]")}>
      <div className="grid content-start gap-0.5 p-1.5">
        {shown.length === 0 ? (
          <Link href={links.signup} className="group/row flex items-center gap-4 rounded-2xl p-3 transition-colors duration-150 hover:bg-canvas">
            <Thumb src="/illustrations/cover-default.svg" className="h-[84px] w-[120px]" />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">New batches are being announced</span>
              <span className="mt-1 block text-[13.5px] leading-snug text-muted">
                Create a free account and we will tell you when the next batch opens.
              </span>
            </span>
          </Link>
        ) : (
          shown.map((c) => (
            <Link
              key={c.id}
              href={`/programs/${c.slug}`}
              className="group/row flex items-center gap-4 rounded-2xl p-2.5 transition-colors duration-150 hover:bg-canvas"
            >
              <Thumb src={coverFor(c)} className="h-[70px] w-[100px]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold text-ink">{c.title}</span>
                  <span className="shrink-0 font-mono text-[11.5px] text-ink-soft">
                    from {formatRupees(c.fromPricePaise)}
                  </span>
                </span>
                {c.tagline ? <span className="mt-0.5 block truncate text-[13px] text-muted">{c.tagline}</span> : null}
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-soft">{c.durationWeeks} weeks</span>
                  {c.nextCohortStartDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff5d2] px-2 py-0.5 text-[11px] font-medium text-[#6b5000]">
                      <HugeiconsIcon icon={Calendar03Icon} size={12} strokeWidth={1.8} aria-hidden />
                      Next batch {formatBatchDate(c.nextCohortStartDate)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">Batch dates coming soon</span>
                  )}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>

      <Link
        href={links.programs}
        className="group/promo relative flex flex-col justify-between overflow-hidden rounded-[18px] bg-[linear-gradient(160deg,var(--sky-1),var(--sky-2)_55%,var(--sky-3))] p-5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG */}
        <img
          src="/illustrations/balloon.svg"
          alt=""
          width={240}
          height={380}
          className="absolute -right-3 top-3 w-[74px] transition-transform duration-700 ease-out group-hover/promo:-translate-y-2 group-hover/promo:rotate-3"
        />
        <span className="relative max-w-[150px] display text-[22px] leading-[1.15] text-ink">
          Not sure where to start?
        </span>
        <span className="relative mt-16">
          <span className="block text-[13px] leading-snug text-sky-ink">
            Module 1 of every program is free to preview. No payment needed.
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
            See all programs
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover/promo:translate-x-[3px]"
            />
          </span>
        </span>
      </Link>
    </div>
  );
}

export function CertificatesPanel() {
  return (
    <div className="grid w-[740px] grid-cols-[1fr_280px] gap-2 p-2">
      <ul className="grid content-start gap-0.5 p-2">
        {docs.map((d) => (
          <li key={d.title}>
            <Link
              href="/#certificates"
              className="group/row flex items-center gap-4 rounded-2xl p-2.5 transition-colors duration-150 hover:bg-canvas"
            >
              <Thumb src={d.img} className="h-[64px] w-[92px]" />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold text-ink">{d.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{d.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href={links.verify} className="group/verify flex flex-col rounded-[18px] bg-ink p-5 text-white">
        <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-highlight">
          <HugeiconsIcon icon={SecurityCheckIcon} size={19} strokeWidth={1.7} aria-hidden />
        </span>
        <span className="mt-4 display text-[22px] leading-[1.15]">
          Any college can check it in seconds
        </span>
        <span className="mt-2 text-[13px] leading-snug text-white/70">
          Every document has a unique ID and QR code. No login, no emails.
        </span>
        <span className="mt-5 flex h-10 items-center gap-2 rounded-full bg-white/[0.08] pl-3.5 pr-1 ring-1 ring-white/15">
          <HugeiconsIcon icon={QrCode01Icon} size={15} strokeWidth={1.7} aria-hidden className="text-white/60" />
          <span className="flex-1 whitespace-nowrap font-mono text-[11px] text-white/80">BYD-26-7KQ4-M9XA</span>
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-semibold text-ink">
            Verify
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              size={14}
              strokeWidth={2}
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover/verify:translate-x-[2px]"
            />
          </span>
        </span>
        <span className="mt-2 text-[11px] text-white/50">Sample ID shown</span>
      </Link>
    </div>
  );
}
