import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, Tick02Icon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";
import { InView } from "@/components/motion/in-view";
import { StackCards } from "@/components/motion/stack-cards";

/*
 * 5.8 Pricing as monday's two stacked panels ("Bring your own agent" /
 * "Use your favorite AI tools"): one honest price card, and a dark panel
 * that previews the message "Send to parents" shares on WhatsApp.
 */

const included = [
  "Full program: lessons, quizzes and a final project",
  "Mentor review of your project",
  "Offer letter, completion certificate and completion letter",
  "Public verification with a unique ID and QR code",
  "WhatsApp community for your batch",
];

const parentLines = [
  "Beyownd Virtual Internship Program",
  "",
  "A project-based online internship with real batch dates. The student learns module by module, passes quizzes, builds a final project reviewed by a mentor, and gets an offer letter, completion certificate and completion letter.",
  "",
  "Fee: Rs 599 to 799, one time. UPI, cards or net banking.",
  "Every certificate can be checked online with its ID or QR code.",
  "",
  "https://beyownd.in",
];
const parentMessage = parentLines.join("\n");

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="px-3 py-20 sm:px-4 sm:py-24 lg:py-28">
      <InView>
      <StackCards from="lg" top={92} step={24} radius="rounded-[32px] sm:rounded-[40px]" className="mx-auto max-w-[1440px]">
      {/* Panel 1: price */}
      <div className="grid gap-10 rounded-[32px] bg-canvas p-6 ring-1 ring-line/60 sm:rounded-[40px] sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:p-16">
        <div className="flex flex-col lg:min-h-[420px] lg:justify-between">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[14px] text-ink shadow-[var(--shadow-float)]">
            <span className="grid size-7 place-items-center rounded-full bg-brand-wash"><LogoMark className="size-4" /></span>
            One price per program
          </span>
          <div className="mt-10 lg:mt-0">
            <h2 id="pricing-title" className="display text-[44px] leading-[1.04] text-ink sm:text-[56px]">
              One price. <span className="text-brand">Everything</span> included.
            </h2>
            <p className="mt-5 max-w-[30rem] text-[17px] leading-[1.6] text-ink-soft">
              No hidden fees and no upsells. Pay once with UPI, cards or net banking.
            </p>
          </div>
        </div>

        <div className="board lift relative p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[14px] text-muted">Per program</p>
              <p className="mt-1 text-[52px] font-light leading-none tracking-[-0.04em] text-ink sm:text-[60px]">₹599–799</p>
            </div>
            <span className="rounded-md bg-butter px-2.5 py-1 text-[12.5px] font-medium text-[#6b5000]">One-time</span>
          </div>
          <ul className="mt-7 space-y-3 border-t border-line pt-6">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-snug text-ink-soft">
                <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-ink text-white">
                  <HugeiconsIcon icon={Tick02Icon} size={11} strokeWidth={2.6} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-xl bg-canvas px-4 py-3 text-[13.5px] leading-snug text-ink-soft">
            Certificates are issued after your batch ends and your project is approved.
          </p>
          <Link href={links.programs} className={cn(buttonVariants({ size: "lg" }), "btn-shine mt-6 w-full")}>
            <span>Choose a program</span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="-mr-1 transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
          </Link>
          <p className="mt-4 text-center text-[13px] text-muted">
            <Link href="/refund-policy" className="link-grow text-ink-soft">Refund &amp; Cancellation Policy</Link>
          </p>
        </div>
      </div>

      {/* Panel 2: parents */}
      <div className="grid gap-10 rounded-[32px] bg-canvas p-6 ring-1 ring-line/60 sm:rounded-[40px] sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:p-16">
        <div className="flex flex-col lg:min-h-[420px] lg:justify-between">
          <span className="inline-flex w-fit items-center gap-3 text-[14px] text-ink-soft">
            <span className="grid size-11 place-items-center rounded-full bg-white shadow-[var(--shadow-float)]"><LogoMark className="size-6" /></span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={22} strokeWidth={1.4} aria-hidden />
            <span className="grid size-11 place-items-center rounded-full bg-white text-[#1f9d55] shadow-[var(--shadow-float)]">
              <HugeiconsIcon icon={WhatsappIcon} size={22} strokeWidth={1.7} aria-hidden />
            </span>
          </span>
          <div className="mt-10 lg:mt-0">
            <h3 className="display text-[40px] leading-[1.06] text-ink sm:text-[52px]">Parents paying?</h3>
            <p className="mt-5 max-w-[30rem] text-[17px] leading-[1.6] text-ink-soft">
              Send them a clear summary of the program, the fee and how verification works, in one tap.
            </p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(parentMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8")}
            >
              <HugeiconsIcon icon={WhatsappIcon} size={18} strokeWidth={1.8} aria-hidden />
              <span>Send to parents</span>
            </a>
          </div>
        </div>

        <div className="rounded-[28px] bg-[#1f2128] p-5 text-white shadow-[var(--shadow-lift)] sm:p-7" aria-label="Preview of the WhatsApp message" role="img">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <span className="grid size-10 place-items-center rounded-full bg-[#2b6b4a] text-[13px] font-semibold">PA</span>
            <div>
              <p className="text-[15px]">Papa</p>
              <p className="text-[12px] text-white/50">WhatsApp</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-[#2b6b4a] px-4 py-3 text-[13.5px] leading-relaxed">
              {parentLines.filter(Boolean).map((l, i) => (
                <p key={i} className={cn(i === 0 && "font-medium", i > 0 && "mt-2 text-white/85", l.startsWith("http") && "text-[#9fe0ff] underline underline-offset-2")}>
                  {l}
                </p>
              ))}
              <p className="mt-2 text-right text-[11px] text-white/50">now</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-[13px] text-white/40">
            Message
            <span className="ml-auto grid size-8 place-items-center rounded-full bg-[#2b6b4a] text-white">
              <HugeiconsIcon icon={ArrowRight02Icon} size={15} strokeWidth={2} aria-hidden />
            </span>
          </div>
        </div>
      </div>
      </StackCards>
      </InView>
    </section>
  );
}
