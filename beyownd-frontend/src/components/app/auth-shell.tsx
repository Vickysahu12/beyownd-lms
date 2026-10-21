"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { afterAuth } from "@/lib/auth-nav";
import { useAuth } from "./auth-provider";

/* Centered card used by login, signup, OTP and password reset. */
export function AuthShell({ title, sub, children, footer }: { title: string; sub?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2">
          <LogoMark className="size-8" />
          <span className="text-[20px] font-semibold tracking-[-0.04em] text-ink">Beyownd</span>
        </Link>
        <div className="mt-8 rounded-[24px] bg-white p-6 shadow-[var(--shadow-board)] ring-1 ring-line sm:p-8">
          <h1 className="text-[28px] font-light tracking-[-0.03em] text-ink">{title}</h1>
          {sub ? <p className="mt-1 text-[14.5px] leading-snug text-muted">{sub}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <p className="mt-6 text-center text-[14px] text-muted">{footer}</p> : null}
      </div>
    </main>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mb-4 rounded-xl bg-[#fde8eb] px-3.5 py-2.5 text-[14px] leading-snug text-[#a3263a]">{children}</p>;
}

export function FormNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p role="status" className="mb-4 rounded-xl bg-mint px-3.5 py-2.5 text-[14px] leading-snug text-success-ink">{children}</p>;
}

/** Logged-in visitors on login/signup go straight to where they belong. */
export function useGuestOnly(next: string | null) {
  const { user, status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated" && user) router.replace(afterAuth(user, next));
  }, [status, user, next, router]);
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[12.5px] text-muted" aria-hidden>
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}
