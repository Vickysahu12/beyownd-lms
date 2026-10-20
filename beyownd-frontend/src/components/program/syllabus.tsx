"use client";

import { useState } from "react";
import Link from "next/link";
import * as Accordion from "@radix-ui/react-accordion";
import { MorphIcon } from "morphicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, CheckListIcon, FileEditIcon, PlayIcon, Remove01Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";
import type { OutlineModule } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/*
 * Syllabus: modules as an accordion. Lessons show their type and minutes;
 * free-preview lessons link to their preview page, the rest show a lock.
 */
export function Syllabus({ slug, modules }: { slug: string; modules: OutlineModule[] }) {
  const [open, setOpen] = useState<string>(modules[0]?.id ?? "");
  return (
    <Accordion.Root type="single" collapsible value={open} onValueChange={setOpen} className="divide-y divide-line overflow-hidden rounded-[24px] bg-white ring-1 ring-line">
      {modules.map((m, i) => {
        const minutes = m.lessons.reduce((t, l) => t + l.estimatedMinutes, 0);
        const isOpen = open === m.id;
        return (
          <Accordion.Item key={m.id} value={m.id}>
            <Accordion.Header>
              <Accordion.Trigger className="group/mod flex w-full items-center gap-4 px-5 py-5 text-left transition-colors duration-150 hover:bg-[#f9fafc] sm:px-6">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[13px]", m.isFreePreview ? "bg-mint text-success-ink" : "bg-canvas text-ink-soft")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[17px] tracking-[-0.02em] text-ink sm:text-[18px]">{m.title}</span>
                    {m.isFreePreview ? <span className="rounded-md bg-mint px-2 py-0.5 text-[11.5px] font-medium text-success-ink">Free preview</span> : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"} · {minutes} min{m.hasQuiz ? " · quiz" : ""}
                  </span>
                </span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas text-ink transition-colors duration-200 group-data-[state=open]/mod:bg-brand group-data-[state=open]/mod:text-white">
                  <MorphIcon icon={isOpen ? Remove01Icon : Add01Icon} size={16} strokeWidth={2} reducedMotion="user" />
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="acc-content">
              <div className="px-5 pb-5 sm:pl-[84px] sm:pr-6">
                {m.description ? <p className="mb-3 text-[14.5px] leading-relaxed text-muted">{m.description}</p> : null}
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {m.lessons.map((l) => {
                    const row = (
                      <>
                        <HugeiconsIcon icon={l.type === "video" ? PlayIcon : FileEditIcon} size={16} strokeWidth={1.7} aria-hidden className="shrink-0 text-ink-soft" />
                        <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{l.title}</span>
                        <span className="shrink-0 text-[12.5px] text-muted">
                          <span className="sr-only">{l.type === "video" ? "Video, " : "Reading, "}</span>
                          {l.estimatedMinutes} min
                        </span>
                        {m.isFreePreview ? (
                          <span className="shrink-0 text-[12.5px] font-medium text-brand">Read free</span>
                        ) : (
                          <HugeiconsIcon icon={SquareLock01Icon} size={14} strokeWidth={1.7} aria-label="Unlocks after enrolling" className="shrink-0 text-muted" />
                        )}
                      </>
                    );
                    return (
                      <li key={l.id}>
                        {m.isFreePreview ? (
                          <Link href={`/programs/${slug}/preview/${l.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-wash/50">
                            {row}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                        )}
                      </li>
                    );
                  })}
                  {m.hasQuiz ? (
                    <li className="flex items-center gap-3 px-4 py-3">
                      <HugeiconsIcon icon={CheckListIcon} size={16} strokeWidth={1.7} aria-hidden className="text-ink-soft" />
                      <span className="flex-1 text-[14.5px] text-ink">Module quiz</span>
                      <span className="text-[12.5px] text-muted">Pass at 60%</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
