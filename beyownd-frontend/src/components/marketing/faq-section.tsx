import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { Section } from "./section";
import { FaqList } from "./faq";

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-title">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <SectionHeading id="faq-title" title={<>Questions, <span className="text-brand">answered</span></>} sub="Straight answers about how the program works." />
          <a href="mailto:hello@beyownd.in" className="reveal mt-8 inline-flex min-h-11 items-center gap-2 text-[15px] text-ink-soft hover:text-ink" style={{ "--i": 2 } as React.CSSProperties}>
            <HugeiconsIcon icon={Mail01Icon} size={18} strokeWidth={1.6} aria-hidden />
            <span className="link-grow">Still unsure? Email us</span>
          </a>
        </div>
        <div className="reveal" style={{ "--i": 2 } as React.CSSProperties}>
          <FaqList />
        </div>
      </div>
    </Section>
  );
}
