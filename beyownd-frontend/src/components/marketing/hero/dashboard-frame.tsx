"use client";

import { useRef } from "react";
import { m, useScroll, useTransform } from "motion/react";

/*
 * The big rounded frame the classroom preview sits in.
 *  - Scroll-linked (never scroll-jacked): starts tilted back a few degrees and
 *    settles flat as it scrolls into view.
 *  - Desktop: a soft light sheen follows the pointer across the glass rim.
 */
export function DashboardFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.25"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const transform = useTransform(() => `rotateX(${rotateX.get()}deg) scale(${scale.get()})`);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !sheen.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    sheen.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    sheen.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="frame-rise [perspective:1600px]">
      <m.div
        ref={ref}
        style={{ transform, transformOrigin: "50% 0%" }}
        onPointerMove={onPointerMove}
        className="group/frame relative rounded-frame motion-reduce:transform-none! bg-white/40 p-2 shadow-frame ring-1 ring-white/70 sm:p-2.5"
      >
        <div className="relative overflow-hidden rounded-card bg-white ring-1 ring-[rgb(24_58_90/0.08)]">
          {children}
        </div>
        <div
          ref={sheen}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-frame opacity-0 transition-opacity duration-300 group-hover/frame:opacity-100 bg-[radial-gradient(520px_circle_at_var(--mx,50%)_var(--my,0px),rgb(255_255_255/0.32),transparent_60%)]"
        />
      </m.div>
    </div>
  );
}
