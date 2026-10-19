"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { BoardGroup, BoardShell, Cell, Initials, StatusCell, type Status } from "@/components/marketing/board/board-ui";
import { cn } from "@/lib/utils";

/*
 * Hero: track chips on the left switch the classroom board on the right.
 * A floating mentor card flips between "Reviewing" and "Approved" every few
 * seconds (paused under reduced motion). All sample data, labelled as such.
 */

type Row = [module: string, lessons: string, quiz: Status, status: Status, due: string];
const tracks: { id: string; label: string; title: string; rows: Row[]; next: Row[] }[] = [
  {
    id: "web",
    label: "Web Development",
    title: "Web Development Internship",
    rows: [
      ["HTML & CSS foundations", "6 / 6", "passed", "done", "Nov 14"],
      ["JavaScript essentials", "7 / 7", "passed", "done", "Nov 21"],
      ["React fundamentals", "3 / 5", "progress", "progress", "Nov 28"],
    ],
    next: [
      ["Backend with Node.js", "0 / 6", "locked", "locked", "Dec 05"],
      ["Final project", "", "locked", "locked", "Dec 15"],
    ],
  },
  {
    id: "data",
    label: "Data Science",
    title: "Data Science Internship",
    rows: [
      ["Python for data", "5 / 5", "passed", "done", "Nov 14"],
      ["pandas and cleaning", "6 / 6", "passed", "done", "Nov 21"],
      ["Charts that explain", "2 / 4", "progress", "progress", "Nov 28"],
    ],
    next: [
      ["Intro to machine learning", "0 / 5", "locked", "locked", "Dec 05"],
      ["Final project", "", "locked", "locked", "Dec 15"],
    ],
  },
  {
    id: "ai",
    label: "AI / ML",
    title: "AI & ML Internship",
    rows: [
      ["Python and NumPy", "5 / 5", "passed", "done", "Nov 14"],
      ["Models and training", "6 / 6", "retry", "progress", "Nov 21"],
      ["Working with LLM APIs", "1 / 5", "locked", "progress", "Nov 28"],
    ],
    next: [
      ["Evaluating models", "0 / 4", "locked", "locked", "Dec 05"],
      ["Final project", "", "locked", "locked", "Dec 15"],
    ],
  },
  {
    id: "design",
    label: "UI/UX Design",
    title: "UI/UX Design Internship",
    rows: [
      ["Design basics", "5 / 5", "passed", "done", "Nov 14"],
      ["User research", "4 / 4", "passed", "done", "Nov 21"],
      ["Prototyping in Figma", "3 / 6", "progress", "progress", "Nov 28"],
    ],
    next: [
      ["Usability testing", "0 / 4", "locked", "locked", "Dec 05"],
      ["Final project", "", "locked", "locked", "Dec 15"],
    ],
  },
  {
    id: "android",
    label: "Android",
    title: "Android Development Internship",
    rows: [
      ["Kotlin basics", "6 / 6", "passed", "done", "Nov 14"],
      ["Layouts and screens", "4 / 5", "progress", "progress", "Nov 21"],
      ["Data and storage", "0 / 5", "locked", "locked", "Nov 28"],
    ],
    next: [
      ["Publishing your app", "0 / 3", "locked", "locked", "Dec 05"],
      ["Final project", "", "locked", "locked", "Dec 15"],
    ],
  },
  {
    id: "security",
    label: "Cybersecurity",
    title: "Cybersecurity Internship",
    rows: [
      ["Networks 101", "5 / 5", "passed", "done", "Nov 14"],
      ["Web security basics", "6 / 6", "passed", "done", "Nov 21"],
      ["Linux and tools", "2 / 5", "progress", "progress", "Nov 28"],
    ],
    next: [
      ["Ethical hacking labs", "0 / 5", "locked", "locked", "Dec 05"],
      ["Final project", "", "locked", "locked", "Dec 15"],
    ],
  },
];

const template = "minmax(0,2.3fr) minmax(0,0.9fr) minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,0.8fr)";
const columns = ["Module", "Lessons", "Quiz", "Status", "Due"];
const mobileTemplate = "minmax(0,1.9fr) minmax(0,1fr) minmax(0,1.1fr)";

function toCells([module, lessons, quiz, status, due]: Row): React.ReactNode[] {
  return [
    <Cell key="m" className="text-ink">{module}</Cell>,
    <Cell key="l" className="text-center font-mono text-[11px]">{lessons || "—"}</Cell>,
    <StatusCell key="q" status={quiz} label={quiz === "locked" ? " " : undefined} className={quiz === "locked" ? "bg-canvas" : undefined} />,
    <StatusCell key="s" status={status} />,
    <Cell key="d" className="text-center text-[11px]">{due}</Cell>,
  ];
}

/* The parent server component can't hold state, so the whole interactive pair lives here. */
export function HeroInteractive({ copy, footer }: { copy: React.ReactNode; footer: React.ReactNode }) {
  const [active, setActive] = useState(tracks[0].id);
  const track = tracks.find((t) => t.id === active)!;
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
      <div>
        {copy}
        <Chips active={active} onChange={setActive} />
        {footer}
      </div>
      <Board key={track.id} track={track} />
    </div>
  );
}

function Chips({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="rise mt-8" style={{ "--d": "380ms" } as React.CSSProperties}>
      <p className="text-[13px] text-muted">Preview a track</p>
      <div role="radiogroup" aria-label="Preview a track" className="mt-3 flex max-w-[520px] flex-wrap gap-2">
        {tracks.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(t.id)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14.5px] transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.96]",
                on ? "bg-brand-wash text-brand" : "bg-canvas text-ink-soft hover:bg-[#eaecf0] hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center overflow-hidden rounded-full bg-brand text-white transition-[width,opacity] duration-200 ease-out",
                  on ? "size-4 opacity-100" : "w-0 opacity-0",
                )}
                aria-hidden
              >
                <HugeiconsIcon icon={Tick02Icon} size={11} strokeWidth={2.6} />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Board({ track }: { track: (typeof tracks)[number] }) {
  const reduce = useReducedMotion();
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setApproved((a) => !a), 3200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative" aria-label={`Sample classroom board for the ${track.label} track`} role="img">
      <div className="swap-in">
        <BoardShell title={track.title}>
          <div className="space-y-5">
            <BoardGroup name="Batch of Nov 10 · This month" color="#579bfc" columns={columns} template={template} mobileTemplate={mobileTemplate} hideOnMobile={[1, 4]} rows={track.rows.map(toCells)} />
            <BoardGroup name="Next" color="#a25ddc" columns={columns} template={template} mobileTemplate={mobileTemplate} hideOnMobile={[1, 4]} rows={track.next.map(toCells)} />
          </div>
        </BoardShell>
      </div>

      {/* Floating mentor card */}
      <div className="float absolute -bottom-8 left-3 right-3 sm:-bottom-10 sm:-left-8 sm:right-auto sm:w-[330px]">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 pr-3.5 shadow-[var(--shadow-lift)] ring-2 ring-[#d9c8ff]">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-peach text-[14px] font-semibold text-[#8a3b12]">RS</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-ink">Rohit, Mentor</span>
            <span className="block truncate text-[12px] text-muted">Final project review</span>
          </span>
          <span
            key={String(approved)}
            className={cn(
              "swap-in inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
              approved ? "bg-mint text-success-ink" : "bg-brand-wash text-brand",
            )}
          >
            {approved ? <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2} aria-hidden /> : null}
            {approved ? "Approved" : "Reviewing"}
          </span>
        </div>
      </div>

      {/* Small quiz bubble */}
      <div className="float absolute -right-3 -top-5 hidden sm:block" style={{ animationDelay: "-3s" }}>
        <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-[var(--shadow-float)] ring-1 ring-line">
          <Initials name="Ananya Rao" tone="bg-butter text-[#6b5000]" className="size-7 ring-0" />
          <span className="text-[12.5px] text-ink">Quiz passed · 4/5</span>
        </div>
      </div>
    </div>
  );
}
