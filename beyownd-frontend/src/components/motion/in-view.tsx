"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Marks a block `data-inview="true"` the first time it scrolls into view, so CSS
 * can play its reveals once (brief §6: reveals play once, never on scroll back).
 *
 * - Server HTML has no attribute, so content is visible without JavaScript.
 * - On mount, only blocks still below the fold are armed (`"false"` hides their
 *   `.reveal` children); anything already on screen is left alone, so nothing
 *   the visitor is looking at ever blinks out.
 * - CSS in globals.css (`.reveal`, `.mark-draw`, `.stamp`) does the animating.
 */
export function InView({
  children,
  className,
  amount = 0.25,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.inview = "false";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.inview = "true";
        io.disconnect();
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
