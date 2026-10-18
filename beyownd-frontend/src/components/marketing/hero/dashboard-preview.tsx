import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Certificate01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  FolderLibraryIcon,
  Home01Icon,
  MentoringIcon,
  Notification01Icon,
  PlayIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/logo";
import { ProgressRing } from "./progress-ring";
import { cn } from "@/lib/utils";

/*
 * A real, responsive mini-version of the classroom dashboard (not a screenshot).
 * It adapts to the frame's width with container queries, so phones see a
 * sensible single column instead of a shrunken desktop.
 * All data is sample data and the frame says so.
 */

const nav: { label: string; icon: IconSvgElement; active?: boolean }[] = [
  { label: "Home", icon: Home01Icon, active: true },
  { label: "My program", icon: BookOpen01Icon },
  { label: "Quizzes", icon: CheckListIcon },
  { label: "Project", icon: FolderLibraryIcon },
  { label: "Documents", icon: Certificate01Icon },
];

type ModuleState = "done" | "active" | "locked";
const modules: { n: string; title: string; meta: string; state: ModuleState; chip?: string }[] = [
  { n: "01", title: "HTML & CSS foundations", meta: "6 lessons", state: "done", chip: "Quiz passed · 5/5" },
  { n: "02", title: "JavaScript essentials", meta: "7 lessons", state: "done", chip: "Quiz passed · 4/5" },
  { n: "03", title: "React fundamentals", meta: "2 of 5 lessons", state: "active" },
  { n: "04", title: "Final project", meta: "Unlocks after Module 3", state: "locked" },
];

export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Beyownd classroom with sample data: module progress, quizzes passed and the certificate status."
      className="@container select-none"
    >
      {/* Window bar with the real app address */}
      <div className="flex h-10 items-center gap-3 border-b border-line bg-[#f7f9fb] px-4">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#e3e7ec]" />
          <span className="size-2.5 rounded-full bg-[#e3e7ec]" />
          <span className="size-2.5 rounded-full bg-[#e3e7ec]" />
        </div>
        <div className="mx-auto flex h-6 items-center rounded-md bg-white px-3 font-mono text-[11px] text-muted ring-1 ring-line">
          classroom.beyownd.in
        </div>
        <span className="font-mono text-[10.5px] text-muted">
          Sample<span className="hidden @md:inline"> data</span>
        </span>
      </div>

      <div className="flex">
        {/* Sidebar (wide frames only) */}
        <aside className="hidden w-[200px] shrink-0 flex-col border-r border-line bg-[#fbfcfd] p-3 @3xl:flex">
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <LogoMark className="size-6" />
            <span className="text-[13.5px] font-semibold text-ink">Classroom</span>
          </div>
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li
                key={item.label}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px]",
                  item.active ? "bg-white font-medium text-ink shadow-float ring-1 ring-line" : "text-muted",
                )}
              >
                <HugeiconsIcon icon={item.icon} size={17} strokeWidth={1.7} />
                {item.label}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2">
            <span className="grid size-8 place-items-center rounded-full bg-sky-3 text-[11px] font-semibold text-sky-ink">
              AR
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[12.5px] font-medium text-ink">Ananya Rao</p>
              <p className="truncate text-[11px] text-muted">BCA, final year</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 p-4 @xl:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[17px] font-semibold tracking-[-0.01em] text-ink @xl:text-[20px]">
                Good evening, Ananya
              </p>
              <p className="mt-0.5 truncate text-[12px] text-muted @xl:text-[13px]">
                <span className="hidden @md:inline">Web Development Internship · </span>Batch of Nov 10 to Dec 22, 2026
              </p>
            </div>
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-line">
              <HugeiconsIcon icon={Notification01Icon} size={17} strokeWidth={1.7} className="text-ink-soft" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-sun" />
            </span>
          </div>

          <div className="mt-4 grid gap-3 @xl:mt-5 @2xl:grid-cols-[1.6fr_1fr]">
            {/* Continue card */}
            <div className="relative overflow-hidden rounded-2xl bg-[#fff5d2] p-4 ring-1 ring-[#f3dd8f] @xl:p-5">
              <div
                aria-hidden
                className="absolute -right-10 -top-12 size-40 rounded-full bg-[radial-gradient(closest-side,rgb(255_213_74/0.7),transparent)]"
              />
              <div className="relative flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-[#7a5b00]">Continue where you left off</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink @xl:text-[16px]">
                    Module 3 · React fundamentals
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-soft">Lesson 3 of 5: Props and state</p>
                  <span className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-medium text-white">
                    <HugeiconsIcon icon={PlayIcon} size={13} strokeWidth={2} />
                    Resume lesson
                  </span>
                </div>
                <ProgressRing value={42} size={68} />
              </div>
            </div>

            {/* Certificate status: honest D2 rule, issued after the batch ends */}
            <div className="hidden rounded-2xl bg-white p-4 ring-1 ring-line @md:block @xl:p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-[#efeaff] text-violet">
                  <HugeiconsIcon icon={Certificate01Icon} size={17} strokeWidth={1.7} />
                </span>
                <p className="text-[13px] font-semibold text-ink">Completion certificate</p>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                Issued after your batch ends and a mentor approves your project.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f6f8fa] px-3 py-2">
                <span className="text-[11.5px] text-muted">Expected</span>
                <span className="font-mono text-[11.5px] text-ink">Dec 22, 2026</span>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div className="mt-3 rounded-2xl bg-white ring-1 ring-line">
            <div className="flex items-center justify-between px-4 pb-1 pt-3.5 @xl:px-5">
              <p className="text-[13px] font-semibold text-ink">Your modules</p>
              <span className="hidden items-center gap-1.5 text-[11.5px] text-muted @md:flex">
                <HugeiconsIcon icon={MentoringIcon} size={14} strokeWidth={1.7} />
                Mentor: Rohit S.
              </span>
            </div>
            <ul className="px-2 pb-2">
              {modules.map((mod) => (
                <li
                  key={mod.n}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-2 py-2.5 @xl:px-3",
                    mod.state === "active" && "bg-sky-3/50",
                    mod.state === "locked" && "@max-md:hidden",
                  )}
                >
                  <StateIcon state={mod.state} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-[13px] font-medium",
                        mod.state === "locked" ? "text-muted" : "text-ink",
                      )}
                    >
                      <span className="mr-2 font-mono text-[11px] text-muted">{mod.n}</span>
                      {mod.title}
                    </p>
                    <p className="text-[11.5px] text-muted">{mod.meta}</p>
                  </div>
                  {mod.chip ? (
                    <span className="hidden shrink-0 rounded-full bg-[#efeaff] px-2.5 py-1 font-mono text-[10.5px] font-medium text-[#5a42d6] @sm:inline">
                      {mod.chip}
                    </span>
                  ) : null}
                  {mod.state === "active" ? (
                    <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-sky-ink ring-1 ring-[rgb(24_58_90/0.12)] @sm:inline">
                      In progress
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: ModuleState }) {
  if (state === "done")
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e3f6ee] text-success-ink">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={17} strokeWidth={1.8} />
      </span>
    );
  if (state === "active")
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-white">
        <HugeiconsIcon icon={BookOpen01Icon} size={15} strokeWidth={1.8} />
      </span>
    );
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f1f3f5] text-muted">
      <HugeiconsIcon icon={SquareLock01Icon} size={15} strokeWidth={1.8} />
    </span>
  );
}
