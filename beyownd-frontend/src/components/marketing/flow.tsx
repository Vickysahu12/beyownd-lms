import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Certificate01Icon,
  FlashIcon,
  GitBranchIcon,
  Github01Icon,
  LockIcon,
  MentoringIcon,
  PencilEdit01Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { Initials } from "@/components/marketing/board/board-ui";
import { cn } from "@/lib/utils";
import { Section } from "./section";

/*
 * monday's "Let work flow", in our words: the real rules a student moves
 * through (quiz pass at 60% with retries, mentor approve or request changes,
 * certificate only after the batch ends). Connectors draw in once on view.
 */
export function Flow() {
  return (
    <Section labelledBy="flow-title">
      <div className="text-center">
        <p className="reveal text-[16px] text-ink-soft">How the rules work</p>
        <h2 id="flow-title" className="reveal display mt-3 text-[52px] leading-[1] text-ink sm:text-[80px] lg:text-[104px]" style={{ "--i": 1 } as React.CSSProperties}>
          Nothing is skipped
        </h2>
        <p className="reveal mx-auto mt-6 flex max-w-[40rem] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[22px] font-light leading-snug tracking-[-0.02em] text-ink sm:text-[30px]" style={{ "--i": 2 } as React.CSSProperties}>
          <span>Every step is checked by</span>
          <span className="inline-flex -space-x-2" aria-hidden>
            <Initials name="Quiz" tone="bg-lavender text-[#5b3aa8]" className="size-9 text-[11px]" />
            <Initials name="Mentor" tone="bg-peach text-[#8a3b12]" className="size-9 text-[11px]" />
            <Initials name="Batch" tone="bg-sky-3 text-brand-navy" className="size-9 text-[11px]" />
          </span>
          <span>quizzes, mentors and real dates</span>
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-[760px]">
        <Node icon={FlashIcon} tone="trigger" title="You join a batch" note="Paid content opens on the batch start date" delay={0} />
        <Line delay={1} />
        <Node icon={BookOpen01Icon} title="Finish the module's lessons" delay={2} />
        <Line delay={3} />
        <Node icon={GitBranchIcon} tone="decision" title="Quiz score 60% or more?" delay={4} />
        <Branch
          delay={5}
          left={{ label: "Yes", icon: LockIcon, title: "Next module unlocks", tone: "good" }}
          right={{ label: "No", icon: RepeatIcon, title: "Review and retry in 1 minute", tone: "plain" }}
        />
        <Line delay={7} />
        <Node icon={Github01Icon} title="Submit your final project" delay={8} />
        <Line delay={9} />
        <Node icon={MentoringIcon} tone="decision" title="A mentor reviews it" delay={10} />
        <Branch
          delay={11}
          left={{ label: "Approved", icon: Certificate01Icon, title: "Certificate after the batch ends", tone: "good" }}
          right={{ label: "Changes", icon: PencilEdit01Icon, title: "Improve and resubmit", tone: "plain" }}
          end
        />
      </div>
    </Section>
  );
}

function Node({
  icon,
  title,
  note,
  tone = "plain",
  delay,
}: {
  icon: IconSvgElement;
  title: string;
  note?: string;
  tone?: "plain" | "trigger" | "decision";
  delay: number;
}) {
  return (
    <div className="reveal relative mx-auto w-full max-w-[460px]" style={{ "--i": delay } as React.CSSProperties}>
      {tone === "trigger" ? (
        <span className="absolute -top-5 left-1/2 z-10 grid size-10 -translate-x-1/2 place-items-center rounded-xl bg-st-done text-white shadow-[var(--shadow-float)]">
          <HugeiconsIcon icon={icon} size={20} strokeWidth={2} aria-hidden />
        </span>
      ) : null}
      <div
        className={cn(
          "lift flex items-center gap-3.5 rounded-2xl bg-white p-3 ring-1",
          tone === "decision" ? "ring-[#c9b8ff] shadow-[0_0_0_4px_var(--lavender)]" : "ring-line",
          tone === "trigger" && "pt-6",
        )}
      >
        {tone !== "trigger" ? (
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone === "decision" ? "bg-lavender text-[#5b3aa8]" : "bg-canvas text-ink-soft")}>
            <HugeiconsIcon icon={icon} size={20} strokeWidth={1.7} aria-hidden />
          </span>
        ) : null}
        <span className={cn("min-w-0", tone === "trigger" && "w-full text-center")}>
          <span className="block text-[16.5px] tracking-[-0.02em] text-ink sm:text-[18px]">{title}</span>
          {note ? <span className="mt-0.5 block text-[13px] text-muted">{note}</span> : null}
        </span>
      </div>
    </div>
  );
}

function Line({ delay }: { delay: number }) {
  return <span aria-hidden className="flow-line mx-auto block h-8 w-px bg-ink/50" style={{ "--fd": `${delay * 70}ms` } as React.CSSProperties} />;
}

type Leaf = { label: string; icon: IconSvgElement; title: string; tone: "good" | "plain" };

function Branch({ left, right, delay, end }: { left: Leaf; right: Leaf; delay: number; end?: boolean }) {
  return (
    <div className="relative">
      <span aria-hidden className="flow-line mx-auto block h-5 w-px bg-ink/50" style={{ "--fd": `${delay * 70}ms` } as React.CSSProperties} />
      <div aria-hidden className="mx-auto h-5 w-1/2 rounded-t-xl border-x border-t border-ink/50" />
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {[left, right].map((leaf, i) => (
          <div key={leaf.label} className="reveal flex flex-col items-center" style={{ "--i": delay + i } as React.CSSProperties}>
            <span className="rounded-md border border-ink/60 bg-white px-3 py-0.5 text-[13px] text-ink">{leaf.label}</span>
            <span aria-hidden className="block h-4 w-px bg-ink/50" />
            <div
              className={cn(
                "lift flex w-full items-center gap-2.5 rounded-2xl bg-white p-2.5 ring-1 sm:gap-3 sm:p-3",
                leaf.tone === "good" ? "ring-[#9fe3bf] shadow-[0_0_0_4px_var(--mint)]" : "ring-line",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl sm:size-10", leaf.tone === "good" ? "bg-mint text-success-ink" : "bg-canvas text-ink-soft")}>
                <HugeiconsIcon icon={leaf.icon} size={18} strokeWidth={1.7} aria-hidden />
              </span>
              <span className="text-[13.5px] leading-snug text-ink sm:text-[15.5px]">{leaf.title}</span>
            </div>
            {end ? <span aria-hidden className="mt-2 block h-6 w-px border-l border-dashed border-ink/30" /> : null}
          </div>
        ))}
      </div>
      {!end ? <div aria-hidden className="mx-auto h-5 w-1/2 rounded-b-xl border-x border-b border-ink/50" /> : null}
    </div>
  );
}
