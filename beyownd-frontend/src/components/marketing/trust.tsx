import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  MentoringIcon,
  QrCode01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { InView } from "@/components/motion/in-view";
import { StackCards } from "@/components/motion/stack-cards";
import { cn } from "@/lib/utils";

/*
 * "Built to be trusted": the heading stays pinned on the left while six cards
 * stack one over another on the right as you scroll (sticky pile, normal scroll).
 */
const points: { title: string; body: string; icon: IconSvgElement; tint: string; ink: string; chip: React.ReactNode }[] = [
  {
    title: "Real batch dates",
    body: "Paid lessons open on the batch start date. The dates on your letters are the dates you actually studied.",
    icon: Calendar03Icon,
    tint: "bg-sky-3",
    ink: "text-brand-navy",
    chip: <span className="font-mono">Nov 10 to Dec 22, 2026</span>,
  },
  {
    title: "Earned, not bought",
    body: "No certificate until every module, every quiz and your final project are done. Paying alone gets you nothing printed.",
    icon: CheckmarkBadge01Icon,
    tint: "bg-butter",
    ink: "text-[#6b5000]",
    chip: <>5 of 5 modules · Project approved</>,
  },
  {
    title: "Mentor in the loop",
    body: "A real mentor reviews your project and either approves it or tells you what to fix. Nothing is auto-approved.",
    icon: MentoringIcon,
    tint: "bg-peach",
    ink: "text-[#8a3b12]",
    chip: <>Rohit, Mentor · Approved</>,
  },
  {
    title: "Public verification",
    body: "Anyone can confirm a document with its ID or by scanning the QR code. No account, no emails, no waiting.",
    icon: QrCode01Icon,
    tint: "bg-lavender",
    ink: "text-[#5b3aa8]",
    chip: <span className="font-mono">BYD-26-7KQ4-M9XA · Verified</span>,
  },
  {
    title: "Revocable",
    body: "If a certificate is obtained dishonestly, it is revoked and its verify page says so for everyone.",
    icon: SecurityCheckIcon,
    tint: "bg-mint",
    ink: "text-success-ink",
    chip: <>Status shown live on the verify page</>,
  },
  {
    title: "Honest wording",
    body: "Every document says exactly what this is: a virtual internship program, with the program name and real dates.",
    icon: File01Icon,
    tint: "bg-canvas",
    ink: "text-ink-soft",
    chip: <>Beyownd Virtual Internship Program</>,
  },
];

export function Trust() {
  return (
    <section aria-labelledby="trust-title" className="px-3 sm:px-4">
      <div className="mx-auto max-w-[1440px] rounded-[32px] bg-canvas py-20 sm:rounded-[40px] sm:py-24 lg:py-28">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-8">
          <InView className="lg:sticky lg:top-28 lg:self-start">
            <h2 id="trust-title" className="reveal display text-[56px] leading-[0.98] text-ink sm:text-[88px] lg:text-[104px]">
              Built to be trusted
            </h2>
            <p className="reveal mt-6 max-w-[26rem] text-[17px] leading-[1.6] text-ink-soft" style={{ "--i": 1 } as React.CSSProperties}>
              A certificate is only worth something if it can&apos;t be faked or bought. These six rules are built into the
              platform, not just written in a policy.
            </p>
            <ol className="reveal mt-8 hidden gap-2 lg:flex" style={{ "--i": 2 } as React.CSSProperties} aria-hidden>
              {points.map((p) => (
                <li key={p.title} className={cn("size-2.5 rounded-full", p.tint, "ring-1 ring-ink/10")} />
              ))}
            </ol>
          </InView>

          <StackCards top={112} step={16}>
            {points.map((p, i) => (
              <article key={p.title} className={cn("group relative min-h-[260px] p-7 sm:p-9", p.tint)}>
                <div className="flex items-start justify-between gap-4">
                  <span className={cn("grid size-14 place-items-center rounded-2xl bg-white/80 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105", p.ink)}>
                    <HugeiconsIcon icon={p.icon} size={26} strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className={cn("font-mono text-[13px]", p.ink)}>0{i + 1} / 06</span>
                </div>
                <h3 className="mt-8 text-[26px] font-light leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">{p.title}</h3>
                <p className="mt-3 max-w-[32rem] text-[16px] leading-[1.6] text-ink-soft">{p.body}</p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[13px] text-ink shadow-[var(--shadow-float)]">
                  <span className="grid size-6 place-items-center rounded-full bg-st-done text-white">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} strokeWidth={2} aria-hidden />
                  </span>
                  {p.chip}
                </span>
              </article>
            ))}
          </StackCards>
        </div>
      </div>
    </section>
  );
}
