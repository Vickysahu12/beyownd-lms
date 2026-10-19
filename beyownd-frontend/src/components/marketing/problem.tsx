import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";
import { Section } from "./section";

/* 5.3 The problem, as a two-column comparison: certificate-only sites vs a Beyownd internship. */

type Group = { title: string; items: string[] };

const them: Group[] = [
  { title: "What you do", items: ["Pay and download a PDF", "No lessons, quizzes or project"] },
  { title: "Dates", items: ["No real batch", "Certificate issued instantly"] },
  { title: "Proof", items: ["Anyone can make the same PDF", "Your college can't check it"] },
  { title: "Support", items: ["No mentor, no feedback"] },
];

const us: Group[] = [
  { title: "What you do", items: ["Learn module by module", "Pass a short quiz for each module", "Build a final project"] },
  { title: "Dates", items: ["A real batch with start and end dates", "The same dates printed on your letters"] },
  { title: "Proof", items: ["A unique ID and QR code on every document", "Anyone can verify it online in seconds"] },
  { title: "Support", items: ["A mentor reviews your project", "A WhatsApp community for your batch"] },
];

export function Problem() {
  return (
    <Section id="problem" labelledBy="problem-title">
      <SectionHeading
        id="problem-title"
        align="center"
        title={
          <>
            Not every internship <Highlightish>counts</Highlightish>
          </>
        }
        sub="Most colleges don't bring internships to campus, so students pay for certificate-only ones that teach nothing and prove nothing. Here's the difference."
      />

      <div className="mt-14 grid gap-4 lg:mt-16 lg:grid-cols-2 lg:gap-0">
        <Column kind="them" heading="Certificate-only sites" groups={them} className="lg:pr-12" />
        <Column kind="us" heading="A Beyownd internship" groups={us} className="rounded-[28px] bg-canvas lg:px-12" />
      </div>
    </Section>
  );
}

function Highlightish({ children }: { children: React.ReactNode }) {
  return <span className="text-brand">{children}</span>;
}

function Column({ kind, heading, groups, className }: { kind: "them" | "us"; heading: string; groups: Group[]; className?: string }) {
  const good = kind === "us";
  return (
    <div className={cn("reveal px-6 py-10 sm:px-10 lg:py-14", className)} style={{ "--i": good ? 3 : 2 } as React.CSSProperties}>
      <h3 className={cn("display text-center text-[32px] sm:text-[40px] lg:text-[44px]", good ? "text-ink" : "text-muted")}>{heading}</h3>
      <div className="mx-auto mt-10 max-w-[440px] space-y-9">
        {groups.map((g) => (
          <div key={g.title}>
            <h4 className={cn("text-[16.5px] font-medium tracking-[-0.02em]", good ? "text-ink" : "text-ink-soft")}>{g.title}</h4>
            <ul className="mt-4 space-y-3">
              {g.items.map((item) => (
                <li key={item} className="group/item flex items-start gap-3.5 text-[15.5px] leading-snug">
                  <span
                    className={cn(
                      "mt-px grid size-6 shrink-0 place-items-center rounded-full transition-transform duration-200 ease-out group-hover/item:scale-110 motion-reduce:transform-none",
                      good ? "bg-ink text-white" : "bg-[#eceef2] text-[#8a8f9c]",
                    )}
                  >
                    <HugeiconsIcon icon={good ? Tick02Icon : Cancel01Icon} size={13} strokeWidth={2.4} aria-hidden />
                  </span>
                  <span className={good ? "text-ink" : "text-muted"}>
                    <span className="sr-only">{good ? "Yes: " : "No: "}</span>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
