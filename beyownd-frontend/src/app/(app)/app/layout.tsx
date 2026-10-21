import { Suspense } from "react";
import type { Metadata } from "next";
import { AppProviders } from "@/components/app/auth-provider";
import { Skeleton } from "@/components/app/ui";

/*
 * Student / mentor / admin app (classroom.beyownd.in; /app in local dev).
 * Never indexed (PAGES.md §5.1). Everything below is client-rendered behind login.
 */
export const metadata: Metadata = {
  title: { default: "Classroom", template: "%s | Beyownd Classroom" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  // Pages read the URL (pathname, params, ?next=) on the client, so the
  // prerendered HTML is only this skeleton and the page streams in.
  return (
    <AppProviders>
      <Suspense
        fallback={
          <div aria-busy className="mx-auto max-w-[1100px] p-6">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="mt-6 h-40" />
          </div>
        }
      >
        {children}
      </Suspense>
    </AppProviders>
  );
}
