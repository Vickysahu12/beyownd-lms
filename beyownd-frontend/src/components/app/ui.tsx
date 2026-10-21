"use client";

import { forwardRef, useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/*
 * App form primitives: label above, helper/error below with a reserved line
 * so validation never makes the layout jump (BRIEF §6). Inputs are 16px on
 * phones so Android/iOS don't zoom on focus.
 */

const control =
  "w-full rounded-input bg-white px-3.5 text-[16px] text-ink outline-none ring-1 ring-line-strong transition-[box-shadow] duration-150 placeholder:text-[#646c78] focus:ring-2 focus:ring-brand disabled:bg-canvas disabled:text-muted sm:text-[15px] aria-[invalid=true]:ring-st-stuck";

type FieldProps = { label: string; error?: string; hint?: string; className?: string; children: (id: string, describedBy: string) => React.ReactNode };

export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-[14px] text-ink-soft">{label}</label>
      {children(id, `${id}-msg`)}
      <p id={`${id}-msg`} className={cn("min-h-[18px] text-[12.5px] leading-snug", error ? "text-[#b42335]" : "text-muted")}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...p }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-11", className)} {...p} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function TextArea({ className, invalid, ...p }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, "min-h-28 py-2.5 leading-relaxed", className)} {...p} />;
  },
);

export function Select({ className, invalid, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select aria-invalid={invalid || undefined} className={cn(control, "h-11 pr-8", className)} {...p} />;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[transform,background-color,box-shadow] duration-140 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55",
        size === "sm" ? "h-9 px-3.5 text-[13.5px]" : "h-11 px-5 text-[15px]",
        variant === "primary" && "bg-brand text-white hover:bg-brand-hover",
        variant === "outline" && "bg-white text-ink ring-1 ring-inset ring-line-strong hover:bg-canvas",
        variant === "ghost" && "text-ink-soft hover:bg-canvas hover:text-ink",
        variant === "danger" && "bg-st-stuck text-white hover:bg-[#c8354b]",
        className,
      )}
    >
      {/* Label stays in place (invisible) while loading, so the width never changes. */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
      {loading ? <HugeiconsIcon icon={Loading03Icon} size={17} strokeWidth={2} aria-label="Working" className="absolute animate-spin motion-reduce:animate-none" /> : null}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-[20px] bg-white ring-1 ring-line", className)}>{children}</div>;
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium",
        tone === "neutral" && "bg-canvas text-ink-soft",
        tone === "good" && "bg-mint text-success-ink",
        tone === "warn" && "bg-butter text-[#6b5000]",
        tone === "bad" && "bg-[#fde8eb] text-[#a3263a]",
        tone === "info" && "bg-brand-wash text-brand",
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-canvas motion-reduce:animate-none", className)} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <p className="text-[15.5px] text-ink">{message}</p>
      {onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button> : null}
    </Card>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-10 text-center">
      <p className="text-[18px] tracking-[-0.02em] text-ink">{title}</p>
      {body ? <p className="max-w-[28rem] text-[14.5px] text-muted">{body}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </Card>
  );
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-light tracking-[-0.03em] text-ink sm:text-[34px]">{title}</h1>
        {sub ? <p className="mt-1 text-[14.5px] text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const istDate = (iso?: string | null, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "Asia/Kolkata" }).format(new Date(iso))
    : "—";

export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className={cn("h-2 overflow-hidden rounded-full bg-canvas", className)}>
      <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${v}%` }} />
    </div>
  );
}
