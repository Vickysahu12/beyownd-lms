"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * LazyMotion + `m` components keep the landing bundle small (brief §8):
 * only the DOM animation features ship, not drag/layout.
 * reducedMotion="user" makes every `m` transform animation instant
 * for people who ask for less motion; opacity still fades.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
