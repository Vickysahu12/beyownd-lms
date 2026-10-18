import { Fragment } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { MentoringIcon, QrCode01Icon, SecurityCheckIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import { links } from "@/lib/site";
import { HeroSky } from "./hero-sky";
import { DashboardFrame } from "./dashboard-frame";
import { DashboardPreview } from "./dashboard-preview";

const trustPoints: { label: string; icon: IconSvgElement }[] = [
  { label: "Mentor-reviewed project", icon: MentoringIcon },
  { label: "Publicly verifiable certificate", icon: SecurityCheckIcon },
  { label: "Pay with UPI from ₹599", icon: SmartPhone01Icon },
];

const headlineWords = ["Earn", "an", "internship", "your", "college", "can"];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--sky-1)_0%,#7ccaf4_28%,var(--sky-2)_50%,var(--sky-3)_74%,var(--cream)_94%)]"
    >
      <HeroSky />

      <div className="relative mx-auto max-w-[1200px] px-4 pt-[112px] sm:px-6 lg:pt-[148px]">
        <div className="mx-auto max-w-[820px] text-center">
          <h1
            id="hero-title"
            className="font-display text-[40px] font-[520] leading-[1.06] tracking-[-0.03em] text-balance text-ink min-[400px]:text-[46px] sm:text-[60px] lg:text-[72px]"
          >
            {headlineWords.map((word, i) => (
              <Fragment key={word}>
                <span className="rise inline-block" style={{ "--d": `${i * 45}ms` } as React.CSSProperties}>
                  {word}
                </span>{" "}
              </Fragment>
            ))}
            <span className="rise inline-block" style={{ "--d": `${headlineWords.length * 45}ms` } as React.CSSProperties}>
              <Highlight delay={headlineWords.length * 45 + 380}>trust</Highlight>
            </span>
          </h1>

          <p
            className="rise mx-auto mt-5 max-w-[34rem] text-[16.5px] leading-[1.6] text-sky-ink sm:mt-6 sm:text-[18px]"
            style={{ "--d": "260ms" } as React.CSSProperties}
          >
            Project-based virtual internships for{" "}
            <span className="whitespace-nowrap">final-year</span> students. Learn step by step, build a project a
            mentor reviews, and get a certificate anyone can verify.
          </p>

          <div
            className="rise mt-8 flex flex-col items-stretch justify-center gap-3 min-[400px]:flex-row min-[400px]:items-center"
            style={{ "--d": "340ms" } as React.CSSProperties}
          >
            <ButtonLink href={links.programs} size="lg" arrow>
              Explore programs
            </ButtonLink>
            <ButtonLink href={links.verify} variant="glass" size="lg" icon={QrCode01Icon}>
              Verify a certificate
            </ButtonLink>
          </div>

          <ul
            className="rise mx-auto mt-8 flex max-w-[640px] flex-wrap items-center justify-center gap-x-6 gap-y-2.5"
            style={{ "--d": "420ms" } as React.CSSProperties}
          >
            {trustPoints.map((point) => (
              <li key={point.label} className="flex items-center gap-2 text-[14px] font-medium text-sky-ink">
                <HugeiconsIcon icon={point.icon} size={18} strokeWidth={1.7} aria-hidden className="text-sky-ink/80" />
                {point.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto mt-24 max-w-[1080px] pb-16 md:mt-32 lg:mt-20 lg:pb-24">
          {/* Phones: the balloon rides on the frame's corner instead of crowding the headline */}
          <div aria-hidden className="pointer-events-none absolute -top-[86px] right-3 z-10 w-[60px] md:-top-[118px] md:right-8 md:w-[72px] lg:hidden">
            <div className="anim-bob">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG art, fixed size */}
              <img src="/illustrations/balloon.svg" alt="" width={240} height={380} className="h-auto w-full" />
            </div>
          </div>
          <DashboardFrame>
            <DashboardPreview />
          </DashboardFrame>
        </div>
      </div>
    </section>
  );
}
