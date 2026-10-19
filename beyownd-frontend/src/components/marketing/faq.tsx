"use client";

import * as Accordion from "@radix-ui/react-accordion";
import Link from "next/link";
import { MorphIcon } from "morphicons/react";
import { Add01Icon, Remove01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";

/* 5.9 FAQ: honest answers. One item open at a time. */

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is this a real internship?",
    a: "It's a structured virtual internship program: a batch with real start and end dates, real work, and a final project reviewed by a mentor. Your documents say exactly that, so there's nothing to hide.",
  },
  {
    q: "Will my college accept it?",
    a: "Every document can be verified online, and the letters follow the format colleges usually ask for. Requirements differ between colleges, so please check with your college or TPO before you enrol.",
  },
  {
    q: "How long does it take?",
    a: "Each program runs for a fixed number of weeks, shown on the program card. The batch dates are the dates printed on your letters.",
  },
  {
    q: "When do I get the certificate?",
    a: "After your batch end date, once you've finished every module and a mentor has approved your project. If you finish early, your dashboard shows the date it will be issued.",
  },
  {
    q: "Can I pay with UPI?",
    a: "Yes. You can pay with UPI, debit or credit cards, or net banking. It's a one-time payment.",
  },
  {
    q: "What if I fail a quiz?",
    a: "No problem. You can retry after a one-minute wait, as many times as you need. You pass at 60%, and your best score is kept.",
  },
  {
    q: "Do I need prior experience?",
    a: "No. Programs are beginner-friendly, and Module 1 of every program is free to preview before you pay.",
  },
  {
    q: "Can I get a refund?",
    a: (
      <>
        The exact terms are in our{" "}
        <Link href="/refund-policy" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Refund &amp; Cancellation Policy
        </Link>
        .
      </>
    ),
  },
];

export function FaqList() {
  const [open, setOpen] = useState<string>("item-0");
  return (
    <Accordion.Root type="single" collapsible value={open} onValueChange={setOpen} className="divide-y divide-line border-y border-line">
      {faqs.map((f, i) => {
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
              <p className="max-w-[60ch] pb-6 pr-12 text-[16px] leading-[1.65] text-ink-soft">{f.a}</p>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
