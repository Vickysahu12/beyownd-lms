import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Beyownd mark: a sun rising past the horizon ("going beyond").
 * A single geometric mark, not an illustration.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <circle cx="16" cy="19" r="7" fill="var(--highlight)" />
      <rect x="5" y="19" width="22" height="8" fill="var(--ink)" />
      <path d="M7 19.5h18" stroke="var(--highlight)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.5 23.5h11" stroke="var(--sky-2)" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Beyownd home"
      className={cn("group/logo inline-flex items-center gap-2 rounded-xl sm:gap-2.5", className)}
    >
      <LogoMark className="size-7 sm:size-8 transition-transform duration-300 ease-out group-hover/logo:-rotate-6" />
      <span className="font-display text-[22px] font-[560] leading-none tracking-[-0.03em] sm:text-[23px] text-ink">Beyownd</span>
    </Link>
  );
}
