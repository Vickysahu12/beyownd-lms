import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Certificate01Icon,
  CheckListIcon,
  FolderLibraryIcon,
  Home01Icon,
  Notification01Icon,
} from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the classroom "board" mockups on the landing page.
 * They're real HTML (not screenshots), always labelled as sample data.
 */

export type Status = "done" | "progress" | "locked" | "review" | "passed" | "retry";

const statusStyle: Record<Status, { label: string; cls: string }> = {
  done: { label: "Completed", cls: "bg-st-done text-white" },
  passed: { label: "Passed", cls: "bg-st-done text-white" },
  progress: { label: "In progress", cls: "bg-st-progress text-white" },
  review: { label: "In review", cls: "bg-st-info text-white" },
  retry: { label: "Retry in 1 min", cls: "bg-st-stuck text-white" },
  locked: { label: "Locked", cls: "bg-[#c4c7d0] text-white" },
};

export function StatusCell({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const s = statusStyle[status];
  return (
    <span className={cn("cell-pop grid h-full min-h-8 place-items-center px-2 text-center text-[11.5px] font-medium", s.cls, className)}>
      {label ?? s.label}
    </span>
  );
}

export function Initials({ name, tone = "bg-sky-3 text-brand-navy", className }: { name: string; tone?: string; className?: string }) {
  const text = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[9.5px] font-semibold ring-2 ring-white", tone, className)}>
      {text}
    </span>
  );
}

/** App chrome around a board: thin icon rail, title, view tabs, "Sample" tag. */
export function BoardShell({
  title,
  tabs = ["Modules", "Timeline", "Documents"],
  children,
  className,
}: {
  title: string;
  tabs?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  const rail = [Home01Icon, BookOpen01Icon, CheckListIcon, FolderLibraryIcon, Certificate01Icon];
  return (
    <div className={cn("board flex overflow-hidden", className)}>
      <div className="hidden w-12 shrink-0 flex-col items-center gap-4 border-r border-line py-4 sm:flex">
        <LogoMark className="size-5" />
        <span className="h-px w-5 bg-line" />
        {rail.map((icon, i) => (
          <HugeiconsIcon key={i} icon={icon} size={16} strokeWidth={1.6} aria-hidden className="text-muted" />
        ))}
      </div>
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[18px] font-normal tracking-[-0.02em] text-ink sm:text-[21px]">{title}</p>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-md bg-canvas px-2 py-0.5 text-[10.5px] font-medium text-muted">Sample data</span>
            <HugeiconsIcon icon={Notification01Icon} size={16} strokeWidth={1.6} aria-hidden className="text-muted max-sm:hidden" />
          </span>
        </div>
        <div className="mt-2 flex gap-5 border-b border-line text-[12px] text-muted">
          {tabs.map((t, i) => (
            <span key={t} className={cn("-mb-px pb-2", i === 0 && "border-b-2 border-brand text-ink")}>
              {t}
            </span>
          ))}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** Grouped table like a monday board: coloured left edge, header row, rows. */
export function BoardGroup({
  name,
  color,
  columns,
  rows,
  template,
  mobileTemplate,
  hideOnMobile = [],
}: {
  name: string;
  color: string;
  columns: string[];
  rows: React.ReactNode[][];
  template: string;
  /** Columns for phones; pair with hideOnMobile so the counts match. */
  mobileTemplate?: string;
  hideOnMobile?: number[];
}) {
  const gridStyle = { "--cols": template, "--cols-sm": mobileTemplate ?? template } as React.CSSProperties;
  const gridCls = "grid [grid-template-columns:var(--cols-sm)] sm:[grid-template-columns:var(--cols)]";
  const hide = (i: number) => (hideOnMobile.includes(i) ? "max-sm:hidden" : "");
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium" style={{ color }}>
        {name}
      </p>
      <div className="overflow-hidden rounded-md border border-line border-l-[5px] text-[12px]" style={{ borderLeftColor: color }}>
        <div className={cn(gridCls, "border-b border-line bg-white text-[10.5px] text-muted")} style={gridStyle}>
          {columns.map((c, i) => (
            <span key={c} className={cn("truncate border-r border-line px-2 py-1.5 text-center first:text-left last:border-r-0", hide(i))}>
              {c}
            </span>
          ))}
        </div>
        {rows.map((cells, r) => (
          <div key={r} className={cn(gridCls, "border-b border-line bg-white transition-colors duration-150 last:border-b-0 hover:bg-[#f6f8fc]")} style={gridStyle}>
            {cells.map((cell, c) => (
              <span key={c} className={cn("flex min-h-8 min-w-0 items-center border-r border-line last:border-r-0 [&>*]:w-full", hide(c))}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("block truncate px-2 text-ink-soft", className)}>{children}</span>;
}
