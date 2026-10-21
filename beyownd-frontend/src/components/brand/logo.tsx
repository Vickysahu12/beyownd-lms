import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Beyownd mark: a navy "b" whose bowl is a forward chevron, chased by a red
 * chevron ("go beyond"). Recreated from the owner's logo image; swap in the
 * official SVG when it's available (same 64-unit box).
 * Gradient ids are unique per instance: with a fixed id, a second logo on the
 * page points at the first one's gradients and renders blank whenever the
 * first is display:none (e.g. the desktop sidebar on phones).
 */
export function LogoMark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const navy = `by-navy-${uid}`;
  const red = `by-red-${uid}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id={navy} x1="0" y1="1" x2="0.6" y2="0">
          <stop offset="0" stopColor="#4a6797" />
          <stop offset="0.3" stopColor="#1c3260" />
          <stop offset="1" stopColor="#13254a" />
        </linearGradient>
        <linearGradient id={red} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4a4a" />
          <stop offset="1" stopColor="#e3121c" />
        </linearGradient>
      </defs>
      <g transform="translate(2 -3.6) scale(1 1.13)">
        <path
          d="M14 13.5a3.5 3.5 0 0 1 3.5-3.5H24v15.2l13.6 7.3a1.4 1.4 0 0 1 0 2.5L19.5 50.6A3.6 3.6 0 0 1 14 47.6z"
          fill={`url(#${navy})`}
        />
        <path d="M24 31.6v9.4l8.4-4.7z" fill="var(--logo-cut, #fbf8f2)" />
        <path
          d="M26.5 10.5l23.6 19.7a2.3 2.3 0 0 1 0 3.5L33.6 47.6a2.6 2.6 0 0 1-3.9-3.3l11.1-11.1a1.5 1.5 0 0 0 0-2.1z"
          fill={`url(#${red})`}
        />
      </g>
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
      <span className="text-[21px] font-semibold leading-none tracking-[-0.04em] text-ink sm:text-[22px]">Beyownd</span>
    </Link>
  );
}
