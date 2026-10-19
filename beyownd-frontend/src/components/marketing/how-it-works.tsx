import { SectionHeading } from "@/components/ui/section-heading";
import { HowTabs } from "./how-tabs";
import { Section } from "./section";

/* 5.4 How it works */
export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-title">
      <SectionHeading id="how-title" align="center" title={<>From enrolment to a certificate you <span className="text-brand">earned</span></>} />
      <div className="mt-12">
        <HowTabs />
      </div>
    </Section>
  );
}
