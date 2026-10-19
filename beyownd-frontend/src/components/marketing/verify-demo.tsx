"use client";

import { useEffect, useRef, useState } from "react";
import { MorphIcon } from "morphicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Copy01Icon, Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/*
 * Landing-page demo of the public verify page. It only knows the sample ID;
 * real verification lives at /verify/<id> (backend Phase 3).
 */
const SAMPLE = "BYD-26-7KQ4-M9XA";
type State = "idle" | "checking" | "verified" | "unknown";

export function VerifyDemo() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>("idle");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setState("checking");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState(value.trim().toUpperCase() === SAMPLE ? "verified" : "unknown");
    }, 650);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE);
    } catch {
      /* clipboard can be blocked; the ID is still visible to type */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="board relative p-5 sm:p-6">
      <form onSubmit={verify} className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="verify-id" className="sr-only">
          Credential ID
        </label>
        <input
          id="verify-id"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state !== "checking") setState("idle");
          }}
          placeholder="BYD-26-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full min-w-0 rounded-input sm:flex-1 bg-[#f6f8fa] px-4 font-mono text-[15px] uppercase tracking-wide text-ink outline-none ring-1 ring-line transition-[box-shadow,background-color] duration-150 placeholder:normal-case placeholder:text-[#646c78] focus:bg-white focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={state === "checking"}
          className="inline-flex h-12 min-w-[112px] items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white transition-[transform,background-color] duration-140 hover:bg-brand-hover active:scale-[0.97] disabled:opacity-80"
        >
          {state === "checking" ? (
            <HugeiconsIcon icon={Loading03Icon} size={18} strokeWidth={2} aria-label="Checking" className="animate-spin motion-reduce:animate-none" />
          ) : (
            "Verify"
          )}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>Try the sample ID:</span>
        <button
          type="button"
          onClick={() => {
            setValue(SAMPLE);
            setState("idle");
          }}
          className="rounded-md px-1 font-mono text-[12.5px] text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
        >
          {SAMPLE}
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy sample ID"}
          className="grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5"
        >
          <MorphIcon icon={copied ? Tick02Icon : Copy01Icon} size={16} strokeWidth={1.8} reducedMotion="user" />
        </button>
      </div>

      {/* Result area keeps a fixed minimum height so nothing below jumps */}
      <div className="mt-5 min-h-[188px]" aria-live="polite">
        {state === "checking" ? (
          <div className="shimmer relative h-[188px] overflow-hidden rounded-2xl bg-[#f1f4f7]" />
        ) : state === "verified" ? (
          <div className="rise rounded-2xl bg-mint/60 p-5 ring-1 ring-[#bfe9d3]">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-success text-white">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
                  <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-[16px] font-semibold text-ink">Verified</p>
                <p className="text-[13px] text-success-ink">This certificate was issued by Beyownd.</p>
              </div>
              <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-line">Sample</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
              <Item label="Name" value="Ananya Rao" />
              <Item label="Program" value="Web Development" />
              <Item label="Batch" value="Nov 10 to Dec 22, 2026" />
              <Item label="Status" value="Completed" />
            </dl>
          </div>
        ) : state === "unknown" ? (
          <div className="rise rounded-2xl bg-[#f6f8fa] p-5 text-[14px] leading-relaxed text-ink-soft ring-1 ring-line">
            This demo only knows the sample ID. Real certificates are checked on their own page at{" "}
            <span className="font-mono text-[13px] text-ink">beyownd.in/verify/&lt;id&gt;</span>, or by scanning the QR code.
          </div>
        ) : (
          <div className="grid h-[188px] place-items-center rounded-2xl border border-dashed border-line-strong text-center text-[14px] text-muted">
            <p className="flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.7} aria-hidden />
              The result shows up here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={cn("font-medium text-ink")}>{value}</dd>
    </div>
  );
}
