"use client";

import { useCallback, useEffect, useState } from "react";

/** Seconds left until a deadline; used for OTP resend and quiz cooldowns. */
export function useCountdown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => (initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until, now]);

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  }, []);

  return [Math.max(0, Math.ceil((until - now) / 1000)), start] as const;
}
