import { ButtonLink } from "@/components/ui/button";
import { links } from "@/lib/site";
import { HeroInteractive } from "./hero-board";

/* Hero: left-aligned light headline, track chips that drive the sample board on the right. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip pb-20 pt-[112px] sm:pt-[132px] lg:pb-28 lg:pt-[164px]">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <HeroInteractive
          copy={
            <>
              <h1
                id="hero-title"
                className="rise display text-balance text-[44px] leading-[1.06] text-ink min-[400px]:text-[50px] sm:text-[64px] lg:text-[72px]"
              >
                Earn an internship your college can <span className="text-gradient">trust</span>
              </h1>
              <p
                className="rise mt-6 max-w-[34rem] text-[17px] leading-[1.6] text-ink-soft sm:text-[19px]"
                style={{ "--d": "120ms" } as React.CSSProperties}
              >
                Project-based virtual internships for final-year students. Learn step by step, build a project a mentor
                reviews, and get a certificate anyone can verify.
              </p>
            </>
          }
          footer={
        <div className="rise mt-9 flex flex-col items-start gap-4" style={{ "--d": "460ms" } as React.CSSProperties}>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={links.signup} size="lg" arrow className="btn-shine">
              Get started
            </ButtonLink>
            <ButtonLink href={links.programs} variant="outline" size="lg">
              Explore programs
            </ButtonLink>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
            <span>Module 1 free to preview</span>
            <span aria-hidden className="size-1 rounded-full bg-line-strong" />
            <span>Pay with UPI from ₹599</span>
            <span aria-hidden className="size-1 rounded-full bg-line-strong" />
            <span>Verifiable certificate</span>
          </p>
        </div>
          }
        />
      </div>
    </section>
  );
}
