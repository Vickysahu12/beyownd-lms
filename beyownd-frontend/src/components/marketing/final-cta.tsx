import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Calendar03Icon, CheckmarkBadge01Icon, MentoringIcon, QrCode01Icon } from "@hugeicons/core-free-icons";
import { ButtonLink } from "@/components/ui/button";
import { links } from "@/lib/site";

/*
 * 5.10 Final CTA: the page's single marquee (pauses on hover, static under
 * reduced motion), then the two actions.
 */
const phrases: { text: string; icon: IconSvgElement; tint: string }[] = [
  { text: "Earned, not bought", icon: CheckmarkBadge01Icon, tint: "bg-butter text-[#6b5000]" },
  { text: "Real batch dates", icon: Calendar03Icon, tint: "bg-sky-3 text-brand-navy" },
  { text: "Mentor-reviewed", icon: MentoringIcon, tint: "bg-peach text-[#8a3b12]" },
  { text: "Verified in seconds", icon: QrCode01Icon, tint: "bg-lavender text-[#5b3aa8]" },
];

export function FinalCta() {
  const row = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {phrases.map((p) => (
        <span key={p.text} className="flex items-center">
          <span className="display whitespace-nowrap px-6 text-[56px] leading-none text-ink sm:px-10 sm:text-[96px] lg:text-[128px]">{p.text}</span>
          <span className={`grid size-14 shrink-0 place-items-center rounded-2xl sm:size-20 lg:size-24 ${p.tint}`}>
            <HugeiconsIcon icon={p.icon} size={36} strokeWidth={1.4} aria-hidden className="size-7 sm:size-10" />
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="cta-title" className="overflow-hidden py-20 sm:py-24 lg:py-28">
      <h2 id="cta-title" className="sr-only">Your internship starts here</h2>
      <div className="marquee-wrap">
        <div className="marquee flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
      <div className="mt-12 flex flex-col items-center gap-4 px-4 text-center">
        <p className="max-w-[30rem] text-[17px] leading-[1.6] text-ink-soft">
          Your internship starts here. Create a free account, preview Module 1, and join a batch when you&apos;re ready.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={links.signup} size="lg" arrow className="btn-shine">
            Get started
          </ButtonLink>
          <ButtonLink href={links.verify} variant="outline" size="lg" arrow>
            Verify a certificate
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
