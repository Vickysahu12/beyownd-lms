"use client";

import { useState } from "react";
import { MorphIcon } from "morphicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, BookOpen01Icon, CheckmarkCircle02Icon, MentoringIcon, Remove01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { Initials } from "@/components/marketing/board/board-ui";
import { cn } from "@/lib/utils";

/*
 * monday's "An agent for every use case": a list of pill items on the left;
 * the open one becomes a white card with its description, and the right side
 * shows a big preview of that item. One item open at a time.
 */

type Item = { id: string; title: string; body: string; chip: string; tint: string; preview: React.ReactNode };

const DocImg = ({ src }: { src: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- fixed-size SVG art
  <img src={src} alt="" width={240} height={168} className="w-full max-w-[460px] rounded-2xl shadow-[var(--shadow-lift)]" />
);

const items: Item[] = [
  {
    id: "offer",
    title: "Offer letter",
    body: "Issued when you join a batch, with the batch's real start and end dates.",
    chip: "Issued on joining",
    tint: "bg-sky-3",
    preview: <DocImg src="/illustrations/doc-offer.svg" />,
  },
  {
    id: "certificate",
    title: "Completion certificate",
    body: "Issued after your batch ends and a mentor approves your project. Carries a unique ID and QR code.",
    chip: "Verifiable with a QR code",
    tint: "bg-butter",
    preview: <DocImg src="/illustrations/doc-certificate.svg" />,
  },
  {
    id: "letter",
    title: "Completion letter",
    body: "Describes the program and the work you did, ready for your college file.",
    chip: "Ready for your college file",
    tint: "bg-mint",
    preview: <DocImg src="/illustrations/doc-letter.svg" />,
  },
  {
    id: "feedback",
    title: "Mentor feedback",
    body: "A mentor reviews your final project and tells you exactly what to improve.",
    chip: "Rubric-based review",
    tint: "bg-peach",
    preview: (
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3">
          <Initials name="Rohit S" tone="bg-peach text-[#8a3b12]" className="size-10 text-[12px] ring-0" />
          <div>
            <p className="text-[15px] text-ink">Rohit, Mentor</p>
            <p className="text-[12px] text-muted">Reviewed your final project</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-[13.5px]">
          {[["Code quality", "Good"], ["Design", "Good"], ["README", "Needs a demo link"]].map(([k, v]) => (
            <li key={k} className="flex justify-between rounded-lg bg-canvas px-3 py-2">
              <span className="text-ink-soft">{k}</span>
              <span className="text-ink">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: "community",
    title: "Batch community",
    body: "A WhatsApp group with the students in your batch for doubts and updates.",
    chip: "Learn with your batch",
    tint: "bg-lavender",
    preview: (
      <div className="w-full max-w-[400px] space-y-2.5">
        {[["Priya", "Anyone stuck on the Module 2 quiz?"], ["Arjun", "Rewatch the functions lesson, it helped me"], ["Priya", "Passed! Thanks"]].map(([n, m], i) => (
          <div key={i} className={cn("flex items-end gap-2", i === 1 && "flex-row-reverse")}>
            <Initials name={n} tone={i === 1 ? "bg-white text-brand-navy" : "bg-white text-[#5b3aa8]"} className="size-8 ring-0 shadow-[var(--shadow-float)]" />
            <p className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] shadow-[var(--shadow-float)]", i === 1 ? "bg-brand text-white" : "bg-white text-ink")}>{m}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "notes",
    title: "Course notes",
    body: "Keep access to your lessons and notes after the batch ends.",
    chip: "Yours to keep",
    tint: "bg-sky-3",
    preview: (
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-[var(--shadow-lift)]">
        <p className="text-[12px] text-muted">Module 2 · Notes</p>
        <p className="mt-1 text-[17px] tracking-[-0.02em] text-ink">Functions</p>
        <pre className="mt-3 overflow-hidden rounded-xl bg-[#1f2230] p-3.5 font-mono text-[12px] leading-relaxed text-[#d6dbf5]">{`function greet(name) {\n  return \`Hello \${name}\`;\n}`}</pre>
      </div>
    ),
  },
];

const icons = { feedback: MentoringIcon, community: UserGroupIcon, notes: BookOpen01Icon } as const;

export function WhatYouGetList() {
  const [open, setOpen] = useState(items[1].id);
  const current = items.find((i) => i.id === open)!;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
      <ul className="space-y-3">
        {items.map((it) => {
          const on = it.id === open;
          return (
            <li key={it.id}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setOpen(it.id)}
                className={cn(
                  "group w-full text-left transition-[background-color,box-shadow,border-radius] duration-300 ease-out",
                  on ? "rounded-[24px] bg-white p-6 shadow-[var(--shadow-board)]" : "rounded-full bg-transparent px-2 py-1 ring-1 ring-line-strong hover:bg-white",
                )}
              >
                <span className="flex items-center gap-3">
                  {!on ? (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-ink/40 transition-transform duration-200 group-hover:rotate-90">
                      <MorphIcon icon={Add01Icon} size={16} strokeWidth={1.8} reducedMotion="user" />
                    </span>
                  ) : null}
                  <span className={cn("text-[17px] tracking-[-0.02em] text-ink", !on && "pr-4")}>{it.title}</span>
                  {on ? <MorphIcon icon={Remove01Icon} size={16} strokeWidth={1.8} className="ml-auto text-muted" reducedMotion="user" /> : null}
                </span>
                {on ? <span className="swap-in mt-2 block text-[15px] leading-relaxed text-muted">{it.body}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div key={current.id} className={cn("swap-in relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-[28px] p-8 sm:min-h-[440px] sm:p-12", current.tint)}>
        {current.id in icons ? (
          <span aria-hidden className="absolute right-6 top-6 grid size-12 place-items-center rounded-2xl bg-white/70 text-ink-soft">
            <HugeiconsIcon icon={icons[current.id as keyof typeof icons]} size={22} strokeWidth={1.6} />
          </span>
        ) : null}
        {current.preview}
        <span className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/85 py-2 pl-2 pr-4 text-[14px] text-ink shadow-[var(--shadow-float)] backdrop-blur">
          <span className="grid size-6 place-items-center rounded-full bg-st-done text-white">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2} aria-hidden />
          </span>
          {current.chip}
        </span>
      </div>
    </div>
  );
}
