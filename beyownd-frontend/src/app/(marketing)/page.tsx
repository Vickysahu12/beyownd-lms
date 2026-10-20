import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero/hero";
import { IncludesStrip } from "@/components/marketing/includes-strip";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Programs } from "@/components/marketing/programs";
import { WhatYouGet } from "@/components/marketing/what-you-get";
import { Flow } from "@/components/marketing/flow";
import { Verify } from "@/components/marketing/verify";
import { Trust } from "@/components/marketing/trust";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Beyownd | Virtual internships your college can trust",
    description:
      "Project-based virtual internships for final-year students. Learn step by step, build a mentor-reviewed project, and get a certificate anyone can verify. From ₹599.",
    path: "/",
  }),
  title: { absolute: "Beyownd | Virtual internships your college can trust" },
};

export default function HomePage() {
  return (
    <>
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
    </>
  );
}
