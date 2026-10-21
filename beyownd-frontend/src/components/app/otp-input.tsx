"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Six single-digit boxes. Typing moves forward, Backspace moves back, paste
 * (or SMS/email autofill into the first box) fills all six. `onComplete`
 * fires once all six digits are present, so the form can auto-submit.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const set = (next: string, focus: number) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.min(focus, 5)]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  };

  return (
    <div role="group" aria-label="6-digit code" aria-describedby={describedBy} className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          maxLength={i === 0 ? 6 : 1}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            // Autofill or a fast typist can put several digits in one box.
            if (typed.length > 1) return set(value.slice(0, i) + typed, i + typed.length);
            set(value.slice(0, i) + typed + value.slice(i + 1), i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d) set(value.slice(0, i) + value.slice(i + 1), i);
              else if (i > 0) set(value.slice(0, i - 1) + value.slice(i), i - 1);
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
            if (pasted) set(pasted, pasted.length);
          }}
          className={cn(
            "h-13 w-full min-w-0 rounded-input bg-white text-center font-mono text-[22px] text-ink outline-none ring-1 ring-line-strong transition-[box-shadow] duration-150 focus:ring-2 focus:ring-brand disabled:bg-canvas",
            invalid && "ring-st-stuck",
          )}
        />
      ))}
    </div>
  );
}
