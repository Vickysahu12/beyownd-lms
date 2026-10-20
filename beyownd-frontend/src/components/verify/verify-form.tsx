"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, Loading03Icon, QrCode01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/*
 * Real verification entry: normalises what people type (lowercase, spaces,
 * missing dashes) and goes to /verify/<id>. The API normalises again.
 */
const PATTERN = /^BYD-\d{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function normaliseId(raw: string) {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === 13 && s.startsWith("BYD")) return `BYD-${s.slice(3, 5)}-${s.slice(5, 9)}-${s.slice(9, 13)}`;
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function VerifyForm({ defaultValue = "", size = "lg" }: { defaultValue?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = normaliseId(value);
    if (!PATTERN.test(id)) {
      setError("That doesn't look like a Beyownd ID. It looks like BYD-26-7KQ4-M9XA.");
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/verify/${id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor="credential-id" className="mb-2 block text-[14px] text-ink-soft">
        Credential ID
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative w-full min-w-0 sm:flex-1">
          <HugeiconsIcon icon={QrCode01Icon} size={18} strokeWidth={1.7} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="credential-id"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="BYD-26-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby="credential-help"
            className={cn(
              "w-full rounded-full bg-white pl-11 pr-4 font-mono uppercase tracking-wide text-ink outline-none ring-1 transition-[box-shadow] duration-150 placeholder:normal-case placeholder:text-[#646c78] focus:ring-2",
              size === "lg" ? "h-14 text-[16px]" : "h-12 text-[15px]",
              error ? "ring-st-stuck focus:ring-st-stuck" : "ring-line-strong focus:ring-brand",
            )}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "group/btn inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-7 font-medium text-white transition-[transform,background-color] duration-150 hover:bg-brand-hover active:scale-[0.97] disabled:opacity-80",
            size === "lg" ? "h-14 min-w-[140px] text-[16px]" : "h-12 min-w-[120px] text-[15px]",
          )}
        >
          {pending ? (
            <HugeiconsIcon icon={Loading03Icon} size={18} strokeWidth={2} aria-label="Checking" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <>
              Verify
              <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
            </>
          )}
        </button>
      </div>
      <p id="credential-help" className={cn("mt-2 min-h-5 text-[13.5px]", error ? "text-[#b42335]" : "text-muted")} role={error ? "alert" : undefined}>
        {error ?? "Printed on the document, under the QR code. Letters and spaces don't matter."}
      </p>
    </form>
  );
}
