"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/**
 * Progress ring + number that count up to their value once, when first seen
 * (brief §6: numbers that change count smoothly to their value).
 */
export function ProgressRing({ value, size = 64 }: { value: number; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();

  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    if (!inView) return;
    const set = (v: number) => {
      arc.current?.setAttribute("stroke-dashoffset", String(c * (1 - v / 100)));
      if (label.current) label.current.textContent = `${Math.round(v)}`;
    };
    if (reduce) return set(value);
    const controls = animate(0, value, { duration: 1.2, delay: 0.5, ease: [0.23, 1, 0.32, 1], onUpdate: set });
    return () => controls.stop();
  }, [inView, reduce, value, c]);

  return (
    <div ref={ref} className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(14 15 18 / 0.08)" strokeWidth={stroke} />
        <circle
          ref={arc}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c}
        />
      </svg>
      <span aria-hidden className="absolute font-mono text-[13px] font-medium tabular-nums text-ink">
        <span ref={label}>0</span>%
      </span>
      <span className="sr-only">{value}% complete</span>
    </div>
  );
}
