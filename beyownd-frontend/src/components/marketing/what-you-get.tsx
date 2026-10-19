import { SectionHeading } from "@/components/ui/section-heading";
import { Section } from "./section";
import { WhatYouGetList } from "./what-you-get-list";

/* 5.6 What you get */
export function WhatYouGet() {
  return (
    <Section id="certificates" labelledBy="get-title">
      <SectionHeading
        id="get-title"
        align="center"
        title={<>Everything you need to <span className="text-brand">show</span> your work</>}
        sub="Three documents for your college, each one earned, plus the support to actually finish."
      />
      <div className="reveal mt-14 rounded-[32px] bg-canvas p-4 sm:mt-16 sm:rounded-[40px] sm:p-10 lg:p-14" style={{ "--i": 2 } as React.CSSProperties}>
        <WhatYouGetList />
      </div>
    </Section>
  );
}
