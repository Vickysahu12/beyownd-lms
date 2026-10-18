import { cn } from "@/lib/utils";

/**
 * The one highlighted word in every section heading (brief §4).
 * The yellow block draws in left to right once. `delay` lets it wait for the
 * headline's own entrance. Server-safe: pure CSS, so it plays before hydration.
 */
export function Highlight({
  children,
  delay = 520,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-block whitespace-nowrap px-[0.1em]", className)}>
      <span
        aria-hidden
        className="mark-draw absolute inset-x-0 bottom-[0.06em] top-[0.16em] [transform:rotate(-1.2deg)] rounded-[0.14em] bg-highlight"
        style={{ animationDelay: `${delay}ms` }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}
