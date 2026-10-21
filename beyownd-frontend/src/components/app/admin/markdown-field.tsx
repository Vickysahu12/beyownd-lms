"use client";

import { useId, useState } from "react";
import { MarkdownClient } from "@/components/content/markdown-client";
import { TextArea } from "@/components/app/ui";
import { cn } from "@/lib/utils";

/*
 * Markdown editor with Write / Preview tabs on phones and a side-by-side live
 * preview on wide screens. The preview uses the same sanitised renderer as
 * the student lesson page, so what admins see is what students get.
 */
export function MarkdownField({
  label,
  value,
  onChange,
  error,
  rows = 16,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  rows?: number;
}) {
  const id = useId();
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[14px] text-ink-soft">{label}</label>
        <div role="tablist" aria-label={`${label} view`} className="flex rounded-full bg-canvas p-0.5 xl:hidden">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-full px-3 py-1 text-[12.5px] capitalize", tab === t ? "bg-white text-ink shadow-[var(--shadow-float)]" : "text-muted")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <TextArea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          invalid={!!error}
          spellCheck
          className={cn("font-mono text-[14px] leading-relaxed sm:text-[13.5px]", tab === "preview" && "max-xl:hidden")}
        />
        <div aria-label="Preview" className={cn("max-h-[640px] overflow-y-auto rounded-input bg-canvas p-4 ring-1 ring-line", tab === "write" && "max-xl:hidden")}>
          {value.trim() ? <MarkdownClient>{value}</MarkdownClient> : <p className="text-[14px] text-muted">Nothing to preview yet.</p>}
        </div>
      </div>
      <p className={cn("min-h-[18px] text-[12.5px]", error ? "text-[#b42335]" : "text-muted")}>{error ?? "Markdown: # headings, **bold**, `code`, ```code blocks```, - lists."}</p>
    </div>
  );
}
