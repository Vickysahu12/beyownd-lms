"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Calendar03Icon,
  ChartIcon,
  CheckListIcon,
  CreditCardIcon,
  DashboardSquare01Icon,
  File02Icon,
  Logout01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/logo";
import { CLASSROOM_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";
import { RequireRole } from "./guard";

/*
 * App shell: left sidebar on desktop, compact top bar with a scrollable tab
 * row on phones. Student and staff areas share it with different links.
 */
type NavLink = { href: string; label: string; icon: IconSvgElement; exact?: boolean };

const mentorLinks: NavLink[] = [{ href: `${CLASSROOM_URL}/review`, label: "Review queue", icon: CheckListIcon }];
const adminLinks: NavLink[] = [
  { href: `${CLASSROOM_URL}/admin`, label: "Overview", icon: ChartIcon, exact: true },
  { href: `${CLASSROOM_URL}/admin/courses`, label: "Courses", icon: BookOpen01Icon },
  { href: `${CLASSROOM_URL}/admin/cohorts`, label: "Batches", icon: Calendar03Icon },
  { href: `${CLASSROOM_URL}/admin/students`, label: "Students", icon: UserGroupIcon },
  { href: `${CLASSROOM_URL}/review`, label: "Review queue", icon: CheckListIcon },
];

const studentLinks: NavLink[] = [
  { href: `${CLASSROOM_URL}/dashboard`, label: "Dashboard", icon: DashboardSquare01Icon },
  { href: `${CLASSROOM_URL}/documents`, label: "Documents", icon: File02Icon },
  { href: `${CLASSROOM_URL}/payments`, label: "Payments", icon: CreditCardIcon },
  { href: `${CLASSROOM_URL}/profile`, label: "Profile", icon: UserCircleIcon },
];

export function StaffShell({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  return (
    <RequireRole roles={roles}>
      <Frame label="Staff" items={(role) => (role === "admin" ? adminLinks : mentorLinks)}>{children}</Frame>
    </RequireRole>
  );
}

/** Any logged-in, onboarded user. Staff also get a link back to their area. */
export function StudentShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole onboarding>
      <Frame
        label="Classroom"
        items={(role) =>
          role === "admin" ? [...studentLinks, { href: `${CLASSROOM_URL}/admin`, label: "Admin", icon: ChartIcon }] : role === "mentor" ? [...studentLinks, mentorLinks[0]] : studentLinks
        }
      >
        {children}
      </Frame>
    </RequireRole>
  );
}

function Frame({ label, items: linksFor, children }: { label: string; items: (role: string) => NavLink[]; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const path = usePathname();
  const items = linksFor(user?.role ?? "student");
  // Links can be absolute (https://classroom.beyownd.in/dashboard); compare paths only.
  const pathOf = (href: string) => href.replace(/^https?:\/\/[^/]+/, "") || "/";
  const isActive = (l: NavLink) => {
    const h = pathOf(l.href);
    return l.exact ? path === h : path === h || path.startsWith(`${h}/`);
  };

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-white p-3 lg:flex">
        <Link href="/" className="flex items-center gap-2 px-2.5 py-3">
          <LogoMark className="size-6" />
          <span className="text-[16px] font-semibold tracking-[-0.03em] text-ink">Beyownd</span>
          <span className="ml-auto rounded-md bg-canvas px-1.5 py-0.5 text-[11px] capitalize text-muted">{user?.role}</span>
        </Link>
        <nav aria-label={label} className="mt-3 grid gap-0.5">
          {items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14.5px] transition-colors duration-150",
                isActive(l) ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <HugeiconsIcon icon={l.icon} size={18} strokeWidth={1.6} aria-hidden />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-3">
          <p className="truncate px-3 text-[13.5px] text-ink">{user?.name}</p>
          <p className="truncate px-3 text-[12px] text-muted">{user?.email}</p>
          <button type="button" onClick={logout} className="mt-2 flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[14px] text-ink-soft hover:bg-canvas hover:text-ink">
            <HugeiconsIcon icon={Logout01Icon} size={17} strokeWidth={1.6} aria-hidden />
            Log out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-white lg:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <LogoMark className="size-6" />
          <span className="text-[15px] font-semibold tracking-[-0.03em] text-ink">Beyownd</span>
          <button type="button" onClick={logout} aria-label="Log out" className="ml-auto grid size-10 place-items-center rounded-full text-ink-soft hover:bg-canvas">
            <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
        <nav aria-label={label} className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l) ? "page" : undefined}
              className={cn("shrink-0 rounded-full px-3.5 py-2 text-[13.5px]", isActive(l) ? "bg-brand-wash text-brand" : "text-ink-soft")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
