"use client";

import { useState } from "react";
import { MorphIcon } from "morphicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, PrinterIcon, Tick02Icon } from "@hugeicons/core-free-icons";

/* "Copy link" (icon morphs to a tick for 1.5 s) and "Print" for the verify result. */
export function ResultActions() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the URL bar still has the link */
    }
  };
  const btn = "inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] text-ink ring-1 ring-line-strong transition-[transform,background-color] duration-150 hover:bg-canvas active:scale-[0.97]";
  return (
    <div className="flex flex-wrap gap-2.5 print:hidden">
      <button type="button" onClick={copy} className={btn} aria-live="polite">
        <MorphIcon icon={copied ? Tick02Icon : Link01Icon} size={17} strokeWidth={1.8} reducedMotion="user" />
        {copied ? "Link copied" : "Copy link"}
      </button>
      <button type="button" onClick={() => window.print()} className={btn}>
        <HugeiconsIcon icon={PrinterIcon} size={17} strokeWidth={1.8} aria-hidden />
        Print
      </button>
    </div>
  );
}
