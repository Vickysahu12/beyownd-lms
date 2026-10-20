"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMotionValueEvent, useScroll } from "motion/react";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, QrCode01Icon } from "@hugeicons/core-free-icons";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import type { CourseCard } from "@/lib/catalog";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CertificatesPanel, ProgramsPanel } from "./nav-panels";
import { MobileMenu } from "./mobile-menu";

/*
 * z-index scale (only these layers exist on the landing page):
 *   z-40  sticky header (and its dropdown viewport)
 *   z-50  mobile menu sheet + overlay, skip link
 */

type Item =
  | { kind: "menu"; id: string; label: string; href: string }
  | { kind: "link"; id: string; label: string; href: string };

const items: Item[] = [
  { kind: "menu", id: "programs", label: "Programs", href: "/#programs" },
  { kind: "link", id: "how-it-works", label: "How it works", href: "/#how-it-works" },
  { kind: "menu", id: "certificates", label: "Certificates", href: "/#certificates" },
  { kind: "link", id: "pricing", label: "Pricing", href: "/#pricing" },
  { kind: "link", id: "faq", label: "FAQ", href: "/faq" },
];

export function NavBar({ courses }: { courses: CourseCard[] }) {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 12;
    setScrolled((prev) => (prev === next ? prev : next));
  });

  return (
    <header
      data-scrolled={scrolled}
      className="group/nav fixed inset-x-0 top-0 z-40 bg-white/95 transition-shadow duration-300 ease-out data-[scrolled=true]:shadow-[0_1px_0_var(--line),0_8px_24px_-16px_rgb(35_38_47/0.25)] [@supports(backdrop-filter:blur(1px))]:bg-white/85 [@supports(backdrop-filter:blur(1px))]:backdrop-blur-xl"
    >
      <NavigationMenu.Root
        aria-label="Main"
        delayDuration={90}
        skipDelayDuration={400}
        className={cn(
          "relative mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:h-[76px] lg:gap-8 lg:px-8",
          "transition-[height] duration-300 ease-out lg:group-data-[scrolled=true]/nav:h-16",
        )}
      >
        <Logo />
        <DesktopItems courses={courses} />
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={links.login}
            className="hidden min-h-11 items-center px-3 text-[15px] text-ink-soft transition-colors hover:text-ink xl:inline-flex"
          >
            <span className="link-grow">Log in</span>
          </Link>
          <ButtonLink
            href={links.verify}
            variant="outline"
            size="sm"
            icon={QrCode01Icon}
            className="hidden h-11 md:inline-flex lg:max-xl:px-3"
          >
            <span className="lg:max-xl:sr-only">Verify a certificate</span>
          </ButtonLink>
          <ButtonLink href={links.signup} size="sm" arrow className="btn-shine h-11 max-[359px]:hidden max-[419px]:px-4 max-[419px]:[&>svg:last-child]:hidden">
            Get started
          </ButtonLink>
          <MobileMenu courses={courses} />
        </div>

        <div className="absolute left-0 right-0 top-full flex justify-center pt-1">
          <NavigationMenu.Viewport className="nav-viewport relative overflow-hidden rounded-[20px] bg-white shadow-[0_5px_45px_rgb(35_38_47/0.15)] ring-1 ring-line" />
        </div>
      </NavigationMenu.Root>
    </header>
  );
}

function DesktopItems({ courses }: { courses: CourseCard[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const capsule = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState("");
  const active = useActiveSection(items.map((i) => i.id));

  // The capsule follows the pointer; while a panel is open it stays on that trigger.
  const target = hovered ?? (open || null);
  const place = useCallback((id: string | null, instant = false) => {
    const list = listRef.current;
    const pill = capsule.current;
    if (!list || !pill) return;
    const el = id ? list.querySelector<HTMLElement>(`[data-nav-id="${id}"]`) : null;
    if (!el) {
      pill.style.opacity = "0";
      return;
    }
    const wasHidden = pill.style.opacity !== "1";
    pill.style.transition = instant || wasHidden ? "opacity 160ms var(--ease-out)" : "";
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.transform = `translate3d(${el.offsetLeft}px, 0, 0)`;
    pill.style.opacity = "1";
  }, []);

  useLayoutEffect(() => place(target), [target, place]);

  return (
    <NavigationMenu.List
      ref={listRef}
      onPointerLeave={() => setHovered(null)}
      className="relative hidden items-center gap-0.5 lg:flex"
    >
      <span
        ref={capsule}
        aria-hidden
        className="nav-capsule pointer-events-none absolute left-0 top-0 h-9 rounded-full bg-canvas opacity-0"
      />
      {items.map((item) =>
        item.kind === "menu" ? (
          <NavigationMenu.Item key={item.id} value={item.id}>
            <NavigationMenu.Trigger
              data-nav-id={item.id}
              onPointerEnter={() => setHovered(item.id)}
              onFocus={() => setHovered(item.id)}
              onBlur={() => setHovered(null)}
              className={cn(
                "group/trigger relative flex h-9 items-center gap-1 rounded-full px-3.5 text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink",
                active === item.id || open === item.id ? "text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={15}
                strokeWidth={2}
                aria-hidden
                className="-mr-1 opacity-60 transition-transform duration-300 ease-out group-data-[state=open]/trigger:rotate-180"
              />
              {active === item.id ? <ActiveMark /> : null}
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className="nav-content absolute left-0 top-0">
              {item.id === "programs" ? <ProgramsPanel courses={courses} /> : <CertificatesPanel />}
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ) : (
          <NavigationMenu.Item key={item.id}>
            <NavigationMenu.Link asChild active={active === item.id}>
              <Link
                href={item.href}
                data-nav-id={item.id}
                onPointerEnter={() => setHovered(item.id)}
                onFocus={() => setHovered(item.id)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "relative flex h-9 items-center rounded-full px-3.5 text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink",
                  active === item.id ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
                {active === item.id ? <ActiveMark /> : null}
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        ),
      )}
      <OpenSync onChange={setOpen} />
    </NavigationMenu.List>
  );
}

/** Small highlighter tick under the section you're currently reading. */
function ActiveMark() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-3.5 bottom-[3px] h-[2px] rounded-full bg-brand"
    />
  );
}

/**
 * Radix keeps the open value internally; this mirrors it into React state by
 * watching the triggers' data-state, so the capsule can rest on the open trigger.
 */
function OpenSync({ onChange }: { onChange: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const list = ref.current?.parentElement;
    if (!list) return;
    const read = () => {
      const openEl = list.querySelector<HTMLElement>('[data-nav-id][data-state="open"]');
      onChange(openEl?.dataset.navId ?? "");
    };
    const mo = new MutationObserver(read);
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => mo.disconnect();
  }, [onChange]);
  return <span ref={ref} hidden />;
}

/** Which landing section is in the middle of the viewport (scroll-spy). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    const els = key
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
  return active;
}
