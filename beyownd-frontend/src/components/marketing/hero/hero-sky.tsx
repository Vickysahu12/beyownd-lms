"use client";

import { useEffect, useRef } from "react";
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

/*
 * The hero sky: sun, clouds and the balloon.
 *  - Ambient loops (drift, bob) are CSS keyframes: they run off the main thread.
 *  - Pointer parallax (desktop, fine pointer only) moves each layer a few px by depth,
 *    through a soft spring so it feels like air, not a cursor follower.
 *  - Loops pause while the hero is off-screen.
 *  - Reduced motion: no parallax, no loops (CSS media query), art stays put.
 */

const SPRING = { stiffness: 60, damping: 20, mass: 0.8 };

export function HeroSky() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.paused = String(!entry.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    const onMove = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, px, py]);

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sun: layered radial glows, warm light from the lower right */}
      <Layer x={sx} y={sy} depth={4} className="-right-[260px] top-[300px] size-[720px] max-md:-right-[300px] max-md:top-[460px] max-md:size-[520px]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(255_200_97/0.85),rgb(255_181_71/0.45)_45%,rgb(255_181_71/0.12)_70%,transparent)]" />
        <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(closest-side,#ffe7a8,#ffc866_70%,#ffb547)] shadow-[0_0_120px_40px_rgb(255_200_97/0.55)]" />
      </Layer>

      <Layer x={sx} y={sy} depth={-6} className="left-[5%] top-[120px] w-[300px] opacity-90 max-md:left-[-90px] max-md:top-[70px] max-md:w-[180px] max-md:opacity-70">
        <Cloud src="/illustrations/cloud-wisp.svg" w={420} h={160} drift={36} duration={80} />
      </Layer>

      <Layer x={sx} y={sy} depth={-9} className="right-[8%] top-[190px] w-[220px] max-md:hidden">
        <Cloud src="/illustrations/cloud-small.svg" w={300} h={150} drift={-28} duration={64} />
      </Layer>

      <Layer x={sx} y={sy} depth={10} className="-left-[200px] top-[520px] w-[820px] max-md:-left-[220px] max-md:top-[640px] max-md:w-[560px]">
        <Cloud src="/illustrations/cloud-bank-left.svg" w={900} h={420} drift={44} duration={90} />
      </Layer>

      <Layer x={sx} y={sy} depth={8} className="-right-[120px] top-[600px] w-[640px] max-md:-right-[200px] max-md:top-[720px] max-md:w-[440px]">
        <Cloud src="/illustrations/cloud-sun.svg" w={760} h={360} drift={-36} duration={76} />
      </Layer>

      {/* The recurring object: a balloon carrying a rolled certificate */}
      <Layer
        x={sx}
        y={sy}
        depth={-16}
        className="left-[max(3%,calc(50%-640px))] top-[250px] w-[150px] max-lg:hidden"
      >
        <div className="anim-bob">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG art, fixed size, no optimisation needed */}
          <img src="/illustrations/balloon.svg" alt="" width={240} height={380} className="h-auto w-full" />
        </div>
      </Layer>
    </div>
  );
}

function Layer({
  x,
  y,
  depth,
  className,
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  depth: number;
  className?: string;
  children: React.ReactNode;
}) {
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth * 0.6);
  const transform = useMotionTemplate`translate3d(${tx}px, ${ty}px, 0)`;
  return (
    <m.div style={{ transform }} className={cn("absolute", className)}>
      {children}
    </m.div>
  );
}

function Cloud({
  src,
  w,
  h,
  drift,
  duration,
}: {
  src: string;
  w: number;
  h: number;
  drift: number;
  duration: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG art, fixed size, no optimisation needed
    <img
      src={src}
      alt=""
      width={w}
      height={h}
      decoding="async"
      className="anim-drift h-auto w-full"
      style={{ "--drift": `${drift}px`, "--drift-duration": `${duration}s` } as React.CSSProperties}
    />
  );
}
