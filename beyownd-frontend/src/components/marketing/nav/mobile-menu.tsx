"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { MorphIcon } from "morphicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Cancel01Icon, Menu01Icon, QrCode01Icon } from "@hugeicons/core-free-icons";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { coverFor, formatRupees, type CourseCard } from "@/lib/catalog";
import { links, navItems } from "@/lib/site";

/*
 * Mobile menu: a card that grows out of the pill. Its own header row sits exactly
 * on top of the pill (same inset, height and radius), and the panel wipes down
 * with clip-path, so the logo never moves and only the icon morphs ☰ → ✕.
 * Radix Dialog gives focus trap, Esc to close and body scroll lock.
 */
export function MobileMenu({ courses }: { courses: CourseCard[] }) {
  const [open, setOpen] = useState(false);
  const pendingHash = useRef<string | null>(null);

  const router = useRouter();

  // Links close the sheet first; navigation happens in onCloseAutoFocus, after
  // the scroll lock is released (a same-page section jump needs that).
  const onSectionClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    pendingHash.current = e.currentTarget.dataset.hash ?? null;
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        className="inline-flex size-11 items-center justify-center rounded-full bg-white/70 text-ink ring-1 ring-[rgb(24_58_90/0.08)] transition-transform duration-140 ease-out active:scale-[0.94] lg:hidden"
      >
        <MorphIcon icon={Menu01Icon} size={20} strokeWidth={1.8} />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay fixed inset-0 z-50 bg-[rgb(14_15_18/0.3)] lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="menu-sheet fixed inset-x-3 top-3 z-50 max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain rounded-[28px] bg-white shadow-[0_24px_64px_-24px_rgb(24_58_90/0.45)] sm:inset-x-4 lg:hidden"
          onCloseAutoFocus={(e) => {
            const href = pendingHash.current;
            if (!href) return;
            pendingHash.current = null;
            e.preventDefault();
            const target = href.startsWith("/#") && window.location.pathname === "/" ? document.querySelector(href.slice(1)) : null;
            if (target) {
              history.pushState(null, "", href.slice(1));
              target.scrollIntoView();
            } else {
              router.push(href);
            }
          }}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex h-14 items-center justify-between pl-3 pr-1.5 sm:pl-4">
            <Logo />
            <Dialog.Close
              aria-label="Close menu"
              className="inline-flex size-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-[rgb(24_58_90/0.08)] transition-transform duration-140 ease-out active:scale-[0.94]"
            >
              <CloseMorph />
            </Dialog.Close>
          </div>

          <nav aria-label="Mobile" className="px-4 pb-5 pt-1">
            <ul>
              {navItems.map((item, i) => (
                <li key={item.href} className="menu-item" style={{ "--i": i } as React.CSSProperties}>
                  <a
                    href={item.href}
                    data-hash={item.href}
                    onClick={onSectionClick}
                    className="group/m flex min-h-[54px] items-center justify-between border-b border-line display text-[28px] text-ink"
                  >
                    {item.label}
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={20}
                      strokeWidth={1.6}
                      aria-hidden
                      className="text-muted transition-transform duration-200 ease-out group-active/m:translate-x-1"
                    />
                  </a>
                </li>
              ))}
            </ul>

            {courses.length > 0 ? (
              <div className="menu-item mt-5" style={{ "--i": navItems.length } as React.CSSProperties}>
                <ul className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  {courses.slice(0, 4).map((c) => (
                    <li key={c.id} className="w-[78%] shrink-0 snap-start">
                      <Link
                        href={`/programs/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-line"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed thumbnail */}
                        <img src={coverFor(c)} alt="" width={240} height={168} className="h-12 w-[68px] shrink-0 rounded-lg object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ink">{c.title}</span>
                          <span className="font-mono text-[11px] text-muted">
                            {c.durationWeeks} weeks / from {formatRupees(c.fromPricePaise)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="menu-item mt-5 grid gap-2.5" style={{ "--i": navItems.length + 1 } as React.CSSProperties}>
              <ButtonLink href={links.signup} size="lg" arrow className="w-full">
                Get started
              </ButtonLink>
              <ButtonLink
                href={links.verify}
                variant="glass"
                size="lg"
                icon={QrCode01Icon}
                className="w-full bg-white/80"
                data-hash={links.verify}
                onClick={onSectionClick}
              >
                Verify a certificate
              </ButtonLink>
              <Link
                href={links.login}
                className="mx-auto mt-1 inline-flex min-h-11 items-center px-3 text-[15px] font-medium text-ink-soft"
              >
                Already enrolled? Log in
              </Link>
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Starts as the menu icon (matching the trigger underneath) and morphs into a close icon. */
function CloseMorph() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <MorphIcon
      icon={ready ? Cancel01Icon : Menu01Icon}
      size={20}
      strokeWidth={1.8}
      spring="snappy"
      reducedMotion="user"
    />
  );
}
