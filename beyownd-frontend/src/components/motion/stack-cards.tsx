"use client";

import { Children, useRef } from "react";
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/*
 * Sticky stacking cards: each card sticks a little lower than the one before,
 * so on scroll they pile up one over another. Cards already in the pile shrink
 * and dim slightly as later cards land on them. Scroll-linked, never
 * scroll-jacked (normal scrolling, no snapping). Reduced motion keeps the
 * sticky pile but drops the scaling.
 *
 * `from`: where stacking starts. Below it the cards are a normal list
 * (tall panels on phones would otherwise hide their own content).
 */
export function StackCards({
  children,
  top = 96,
  step = 18,
  from = "always",
  radius = "rounded-[28px]",
  className,
}: {
  children: React.ReactNode;
  top?: number;
  step?: number;
  from?: "always" | "lg";
  /** Corner radius class of the cards, so the dimming layer matches them. */
  radius?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className={cn("relative", className)}>
      {items.map((child, i) => (
        <Card key={i} index={i} count={items.length} progress={scrollYProgress} top={top + i * step} from={from} radius={radius}>
          {child}
        </Card>
      ))}
    </div>
  );
}

function Card({
  index,
  count,
  progress,
  top,
  from,
  radius,
  children,
}: {
  radius: string;
  index: number;
  count: number;
  progress: MotionValue<number>;
  top: number;
  from: "always" | "lg";
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  // Each later card that lands on this one shrinks it a little more.
  const start = index / count;
  const target = 1 - (count - 1 - index) * 0.04;
  const scale = useTransform(progress, [start, 1], [1, target]);
  const dim = useTransform(progress, [start, 1], [0, (count - 1 - index) * 0.06]);
  const transform = useTransform(scale, (s) => (reduce ? "none" : `scale(${s})`));

  return (
    <div
      className={cn(from === "always" ? "sticky" : "lg:sticky", "mb-6 last:mb-0")}
      style={{ top }}
    >
      <m.div style={{ transform, transformOrigin: "50% 0%" }} className={cn("relative overflow-hidden", radius)}>
        {children}
        {!reduce ? (
          <m.span aria-hidden style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-ink" />
        ) : null}
      </m.div>
    </div>
  );
}
