"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CLASSROOM_URL } from "@/lib/site";
import { useAuth } from "./auth-provider";
import { Skeleton } from "./ui";

/*
 * Auth + role guard. Not logged in → /login?next=<here>. Wrong role → a clear
 * "no access" message (the API enforces roles too; this is only for UX).
 * With `onboarding`, users who haven't finished onboarding go there first
 * (the backend's requireOnboarding blocks enroll/payment anyway).
 */
export function RequireRole({ roles, onboarding, children }: { roles?: string[]; onboarding?: boolean; children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${path}?${search}` : path;
  const needsOnboarding = !!onboarding && !!user && !user.onboardingCompleted;

  useEffect(() => {
    if (status === "anonymous") router.replace(`${CLASSROOM_URL}/login?next=${encodeURIComponent(here)}`);
    else if (needsOnboarding) router.replace(`${CLASSROOM_URL}/onboarding?next=${encodeURIComponent(here)}`);
  }, [status, router, here, needsOnboarding]);

  if (status !== "authenticated" || !user || needsOnboarding) {
    return (
      <div aria-busy className="mx-auto max-w-[1100px] p-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-40" />
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-24 text-center">
        <h1 className="text-[28px] font-light tracking-[-0.03em] text-ink">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-[15px] text-muted">It&apos;s only for {roles.join(" or ")} accounts. If you think this is wrong, ask an admin to change your role.</p>
      </div>
    );
  }
  return <>{children}</>;
}
