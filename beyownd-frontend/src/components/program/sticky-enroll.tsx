"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/*
 * Mobile-only bottom bar with the price and "Enroll", shown once the hero CTA
 * (#program-cta) scrolls out of view and hidden again over the batches section.
 */
export function StickyEnroll({ price }: { price: string | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const cta = document.getElementById("program-cta");
    const batches = document.getElementById("batches");
    if (!cta) return;
    let ctaGone = false;
    let atBatches = false;
    const update = () => setShow(ctaGone && !atBatches);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === cta) ctaGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === batches) atBatches = e.isIntersecting;
      }
      update();
    });
    io.observe(cta);
    if (batches) io.observe(batches);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 ease-out md:hidden",
        show ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span>
          {price ? (
            <>
              <span className="block text-[11.5px] text-muted">from</span>
              <span className="text-[22px] font-light leading-none tracking-[-0.03em] text-ink">{price}</span>
            </>
          ) : (
            <span className="text-[14px] text-muted">Batches coming soon</span>
          )}
        </span>
        <a href="#batches" tabIndex={show ? 0 : -1} className="inline-flex h-12 items-center rounded-full bg-brand px-6 text-[15.5px] font-medium text-white active:scale-[0.97]">
          Enroll in a batch
        </a>
      </div>
    </div>
  );
}
