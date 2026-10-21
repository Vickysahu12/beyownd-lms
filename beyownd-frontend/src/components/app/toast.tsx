"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/*
 * Toasts (BRIEF §6): bottom on mobile, top-right on desktop, auto-dismiss
 * after 4 s, never block content. Transitions (not keyframes) so rapid toasts retarget.
 */
type Toast = { id: number; kind: "success" | "error"; text: string; shown: boolean };
const Ctx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text, shown: false }]);
    requestAnimationFrame(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, shown: true } : x))));
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, shown: false } : x))), 4000);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4300);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-[420px] items-start gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[14.5px] text-white shadow-[var(--shadow-lift)] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-opacity",
              t.shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 sm:-translate-y-2",
            )}
          >
            <HugeiconsIcon
              icon={t.kind === "success" ? CheckmarkCircle02Icon : Alert02Icon}
              size={18}
              strokeWidth={1.8}
              aria-hidden
              className={cn("mt-px shrink-0", t.kind === "success" ? "text-[#7be3b4]" : "text-[#ff9aa9]")}
            />
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
