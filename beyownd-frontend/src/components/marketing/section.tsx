import { InView } from "@/components/motion/in-view";
import { cn } from "@/lib/utils";

/*
 * Every landing section uses this wrapper so width and rhythm stay identical.
 *   white: content straight on the page
 *   panel: a soft grey rounded panel inset from the page edges (monday-style band)
 */
export function Section({
  id,
  labelledBy,
  tone = "white",
  className,
  innerClassName,
  children,
}: {
  id?: string;
  labelledBy: string;
  tone?: "white" | "panel";
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn(tone === "panel" ? "px-3 sm:px-4" : "", className)}>
      <div
        className={cn(
          tone === "panel" ? "mx-auto max-w-[1440px] rounded-[32px] bg-canvas py-20 sm:rounded-[40px] sm:py-24 lg:py-28" : "py-20 sm:py-24 lg:py-28",
        )}
      >
        <InView className={cn("mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8", innerClassName)}>{children}</InView>
      </div>
    </section>
  );
}
