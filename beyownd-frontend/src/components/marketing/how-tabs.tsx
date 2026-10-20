"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Github01Icon,
  Link01Icon,
  PlayIcon,
  QrCode01Icon,
} from "@hugeicons/core-free-icons";
import { BoardGroup, BoardShell, Cell, Initials, StatusCell } from "@/components/marketing/board/board-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * 5.4 How it works as monday-style tabs: a pill tab bar with a sliding
 * indicator; each tab swaps the copy on the left and the board on the right.
 * Radix-free on purpose: a WAI-ARIA tablist with arrow-key support.
 */

type Tab = { id: string; tab: string; title: string; accent: string; body: string; cta: string; href: string; panel: React.ReactNode };

const tabs: Tab[] = [
  {
    id: "join",
    tab: "Join a batch",
    title: "Pick a batch.",
    accent: "Real dates.",
    body: "Every program runs in a batch with a fixed start and end date. Those exact dates are printed on your offer letter and certificate.",
    cta: "See programs",
    href: "/programs",
    panel: <JoinPanel />,
  },
  {
    id: "learn",
    tab: "Learn",
    title: "Learn it.",
    accent: "Step by step.",
    body: "Short lessons and videos you can finish on your phone. The next module opens when you complete the one before it.",
    cta: "Preview Module 1 free",
    href: "/app/signup",
    panel: <LearnPanel />,
  },
  {
    id: "quiz",
    tab: "Quiz",
    title: "Prove it.",
    accent: "Module by module.",
    body: "A short quiz at the end of every module. Pass at 60%. Missed it? Review and try again after a one-minute wait.",
    cta: "Quiz rules",
    href: "/faq",
    panel: <QuizPanel />,
  },
  {
    id: "project",
    tab: "Project",
    title: "Build it.",
    accent: "Get it reviewed.",
    body: "Build a real project and submit your GitHub link. A mentor reviews it and either approves it or tells you what to improve.",
    cta: "What you get",
    href: "/#certificates",
    panel: <ProjectPanel />,
  },
  {
    id: "certificate",
    tab: "Certificate",
    title: "Show it.",
    accent: "Anyone can verify.",
    body: "After your batch ends and your project is approved, you get a completion certificate and letter, each with a QR code.",
    cta: "Try verifying",
    href: "/verify",
    panel: <CertificatePanel />,
  },
];

export function HowTabs() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[active];
    if (!el || !pill.current) return;
    pill.current.style.width = `${el.offsetWidth}px`;
    pill.current.style.transform = `translate3d(${el.offsetLeft}px,0,0)`;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActive(next);
    list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  const t = tabs[active];
  return (
    <div>
      <div className="reveal flex min-w-0 justify-center" style={{ "--i": 2 } as React.CSSProperties}>
        <div
          ref={list}
          role="tablist"
          aria-label="Steps"
          onKeyDown={onKey}
          className="relative flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1.5 shadow-[var(--shadow-board)] ring-1 ring-line [scrollbar-width:none]"
        >
          <span ref={pill} aria-hidden className="absolute left-0 top-1.5 h-[calc(100%-12px)] rounded-full bg-brand-wash transition-[transform,width] duration-300 ease-out motion-reduce:transition-none" />
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={i === active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                "relative shrink-0 rounded-full px-4 py-2.5 text-[15px] transition-colors duration-200 sm:px-6",
                i === active ? "text-brand" : "text-muted hover:text-ink",
              )}
            >
              {tab.tab}
            </button>
          ))}
        </div>
      </div>

      <div
        key={t.id}
        role="tabpanel"
        id={`panel-${t.id}`}
        aria-labelledby={`tab-${t.id}`}
        className="mt-12 grid grid-cols-1 items-center gap-10 lg:mt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
      >
        <div className="swap-in">
          <h3 className="display text-[34px] leading-[1.1] text-ink sm:text-[42px]">
            {t.title} <span className="text-brand">{t.accent}</span>
          </h3>
          <p className="mt-5 max-w-[30rem] text-[17px] leading-[1.6] text-ink-soft">{t.body}</p>
          <Link href={t.href} className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
            <span>{t.cta}</span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="-mr-1 transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
          </Link>
        </div>
        <div className="swap-in rounded-[28px] bg-canvas p-3 sm:p-6" style={{ animationDelay: "60ms" }} aria-hidden>
          {t.panel}
        </div>
      </div>
    </div>
  );
}

/* ---------- Panels (sample data) ---------- */

function JoinPanel() {
  const t = "minmax(0,1.6fr) minmax(0,1.3fr) minmax(0,0.8fr) minmax(0,1fr)";
  return (
    <BoardShell title="Web Development · Choose a batch" tabs={["Batches", "Outline", "Reviews"]}>
      <BoardGroup
        name="Open batches"
        color="#579bfc"
        template={t}
        mobileTemplate="minmax(0,1.4fr) minmax(0,1.5fr) minmax(0,1fr)"
        hideOnMobile={[2]}
        columns={["Batch", "Dates", "Price", "Seats"]}
        rows={[
          [<Cell key="a" className="text-ink">Nov 10 batch</Cell>, <Cell key="b" className="text-center">Nov 10 to Dec 22</Cell>, <Cell key="c" className="text-center font-mono text-[11px]">₹599</Cell>, <StatusCell key="d" status="done" label="Open" />],
          [<Cell key="a" className="text-ink">Dec 01 batch</Cell>, <Cell key="b" className="text-center">Dec 1 to Jan 12</Cell>, <Cell key="c" className="text-center font-mono text-[11px]">₹599</Cell>, <StatusCell key="d" status="done" label="Open" />],
          [<Cell key="a" className="text-ink">Jan 05 batch</Cell>, <Cell key="b" className="text-center">Jan 5 to Feb 16</Cell>, <Cell key="c" className="text-center font-mono text-[11px]">₹699</Cell>, <StatusCell key="d" status="progress" label="Soon" />],
        ]}
      />
      <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-wash px-4 py-3">
        <span className="text-[13px] text-ink">Your letters will say: <b className="font-medium">Nov 10 to Dec 22, 2026</b></span>
        <span className="rounded-full bg-brand px-3 py-1 text-[12px] text-white">Join</span>
      </div>
    </BoardShell>
  );
}

function LearnPanel() {
  const lessons = [
    { t: "How the web works", m: "12 min", s: "done" as const },
    { t: "HTML: structure of a page", m: "15 min", s: "done" as const },
    { t: "CSS basics (video)", m: "20 min", s: "progress" as const },
    { t: "Module 1 quiz", m: "5 questions", s: "locked" as const },
  ];
  return (
    <BoardShell title="Module 1 · Web foundations" tabs={["Lessons", "Notes", "Community"]}>
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>2 of 3 lessons done</span>
        <span className="font-mono">67%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
        <div className="h-full w-2/3 rounded-full bg-st-done" />
      </div>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {lessons.map((l) => (
          <li key={l.t} className="flex items-center gap-3 px-3 py-2.5">
            <span className={cn("grid size-7 place-items-center rounded-full", l.s === "done" ? "bg-mint text-success-ink" : l.s === "progress" ? "bg-brand text-white" : "bg-canvas text-muted")}>
              <HugeiconsIcon icon={l.s === "done" ? CheckmarkCircle02Icon : PlayIcon} size={14} strokeWidth={2} />
            </span>
            <span className="flex-1 truncate text-[13px] text-ink">{l.t}</span>
            <span className="text-[11.5px] text-muted">{l.m}</span>
          </li>
        ))}
      </ul>
    </BoardShell>
  );
}

function QuizPanel() {
  const t = "minmax(0,1.8fr) minmax(0,0.9fr) minmax(0,1.1fr)";
  return (
    <BoardShell title="Quizzes · Web Development" tabs={["Attempts", "Questions", "Rules"]}>
      <BoardGroup
        name="Your attempts"
        color="#a25ddc"
        template={t}
        columns={["Quiz", "Score", "Result"]}
        rows={[
          [<Cell key="a" className="text-ink">Module 1 · Web foundations</Cell>, <Cell key="b" className="text-center font-mono text-[11px]">5 / 5</Cell>, <StatusCell key="c" status="passed" />],
          [<Cell key="a" className="text-ink">Module 2 · JavaScript</Cell>, <Cell key="b" className="text-center font-mono text-[11px]">2 / 5</Cell>, <StatusCell key="c" status="retry" />],
          [<Cell key="a" className="text-ink">Module 2 · JavaScript</Cell>, <Cell key="b" className="text-center font-mono text-[11px]">4 / 5</Cell>, <StatusCell key="c" status="passed" />],
        ]}
      />
      <p className="mt-4 rounded-xl bg-mint px-4 py-3 text-[13px] text-success-ink">Module 3 unlocked. Nice work.</p>
    </BoardShell>
  );
}

function ProjectPanel() {
  return (
    <BoardShell title="Final project · Portfolio site" tabs={["Submission", "Feedback", "History"]}>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5">
          <HugeiconsIcon icon={Github01Icon} size={16} strokeWidth={1.7} className="text-ink-soft" />
          <span className="truncate font-mono text-[12px] text-ink">github.com/ananya/portfolio</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5">
          <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={1.7} className="text-ink-soft" />
          <span className="truncate font-mono text-[12px] text-ink">ananya-portfolio.vercel.app</span>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-canvas p-3.5">
        <div className="flex items-center gap-2.5">
          <Initials name="Rohit S" tone="bg-peach text-[#8a3b12]" className="size-8 ring-0" />
          <span className="flex-1 text-[13px] text-ink">Rohit, Mentor</span>
          <span className="rounded-md bg-st-done px-2 py-1 text-[11.5px] font-medium text-white">Approved</span>
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">Clean layout and a clear README. Good use of components. Approved.</p>
      </div>
    </BoardShell>
  );
}

function CertificatePanel() {
  return (
    <BoardShell title="My documents" tabs={["Documents", "Verify", "Share"]}>
      <div className="grid gap-3 sm:grid-cols-[1.25fr_1fr]">
        <div className="rounded-xl bg-butter p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size SVG art */}
          <img src="/illustrations/doc-certificate.svg" alt="" width={240} height={168} className="w-full rounded-lg" />
        </div>
        <ul className="space-y-2 text-[12.5px]">
          {[
            ["Offer letter", "Issued Nov 10"],
            ["Completion certificate", "Issued Dec 22"],
            ["Completion letter", "Issued Dec 22"],
          ].map(([n, d]) => (
            <li key={n} className="rounded-xl border border-line px-3 py-2">
              <p className="text-ink">{n}</p>
              <p className="text-[11px] text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint px-3 py-2.5 text-[12.5px] text-success-ink">
        <HugeiconsIcon icon={QrCode01Icon} size={15} strokeWidth={1.8} />
        <span className="font-mono">BYD-26-7KQ4-M9XA</span>
        <span className="ml-auto font-medium">Verified</span>
      </div>
    </BoardShell>
  );
}
