"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CircleIcon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Field, TextInput } from "./ui";

/* Same rules as the backend's newPasswordRule (auth.validator.ts). */
export const passwordRules = [
  { label: "8-64 characters", test: (p: string) => p.length >= 8 && p.length <= 64 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
  { label: "A special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
export const passwordOk = (p: string) => passwordRules.every((r) => r.test(p));

export function PasswordField({
  label = "Password",
  value,
  onChange,
  error,
  autoComplete = "current-password",
  showRules,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  showRules?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error}>
      {(id, d) => (
        <>
          <div className="relative">
            <TextInput
              id={id}
              aria-describedby={showRules ? `${d} ${id}-rules` : d}
              type={visible ? "text" : "password"}
              autoComplete={autoComplete}
              value={value}
              invalid={!!error}
              onChange={(e) => onChange(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink"
            >
              <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} size={18} strokeWidth={1.7} aria-hidden />
            </button>
          </div>
          {showRules ? (
            <ul id={`${id}-rules`} className="mt-1 grid grid-cols-1 gap-x-3 gap-y-1 text-[12.5px] min-[400px]:grid-cols-2">
              {passwordRules.map((r) => {
                const ok = r.test(value);
                return (
                  <li key={r.label} className={cn("flex items-center gap-1.5 transition-colors duration-150", ok ? "text-success-ink" : "text-muted")}>
                    <HugeiconsIcon icon={ok ? CheckmarkCircle02Icon : CircleIcon} size={14} strokeWidth={1.8} aria-hidden />
                    {r.label}
                    <span className="sr-only">{ok ? "(done)" : "(missing)"}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </Field>
  );
}
