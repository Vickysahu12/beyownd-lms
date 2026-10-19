import { SiteNav } from "@/components/marketing/nav/site-nav";
import { Hero } from "@/components/marketing/hero/hero";
import { IncludesStrip } from "@/components/marketing/includes-strip";
import { Problem } from "@/components/marketing/problem";
import { Flow } from "@/components/marketing/flow";
import { Trust } from "@/components/marketing/trust";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Programs } from "@/components/marketing/programs";
import { WhatYouGet } from "@/components/marketing/what-you-get";
import { Verify } from "@/components/marketing/verify";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-ink focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-[14px] focus-visible:font-medium focus-visible:text-white"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <IncludesStrip />
        <Problem />
        <HowItWorks />
        <Programs />
        <WhatYouGet />
        <Flow />
        <Verify />
        <Trust />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
