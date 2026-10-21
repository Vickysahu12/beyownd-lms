"use client";

import * as Accordion from "@radix-ui/react-accordion";
import Link from "next/link";
import { MorphIcon } from "morphicons/react";
import { Add01Icon, Remove01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { landingFaqs, type FaqItem } from "@/lib/faq-data";

/* FAQ accordion: honest answers (lib/faq-data.ts). One item open at a time. */

export function FaqList({ items = landingFaqs, firstOpen = true }: { items?: FaqItem[]; firstOpen?: boolean }) {
  const [open, setOpen] = useState<string>(firstOpen ? "item-0" : "");
  return (
    <Accordion.Root type="single" collapsible value={open} onValueChange={setOpen} className="divide-y divide-line border-y border-line">
      {items.map((f, i) => {
        const value = `item-${i}`;
        return (
          <Accordion.Item key={f.q} value={value}>
            <Accordion.Header>
              <Accordion.Trigger className="group/faq flex w-full items-center justify-between gap-4 py-6 text-left text-[17px] tracking-[-0.02em] text-ink transition-colors duration-150 hover:text-brand sm:text-[19px]">
                {f.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas text-ink transition-colors duration-200 group-data-[state=open]/faq:bg-brand group-data-[state=open]/faq:text-white">
                  <MorphIcon icon={open === value ? Remove01Icon : Add01Icon} size={16} strokeWidth={2} reducedMotion="user" />
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="acc-content">
              <p className="max-w-[60ch] pb-6 pr-12 text-[16px] leading-[1.65] text-ink-soft">
                {f.a}
                {f.link ? (
                  <>
                    {" "}
                    <Link href={f.link.href} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">{f.link.text}</Link>
                  </>
                ) : null}
              </p>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
