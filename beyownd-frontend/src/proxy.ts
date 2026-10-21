import { NextResponse, type NextRequest } from "next/server";

/*
 * Host routing (PAGES.md §1). One Next.js project serves two hosts:
 *   beyownd.in            → (marketing) routes
 *   classroom.beyownd.in  → (app) routes, which live under /app in the tree
 *
 * On the classroom host, /dashboard is rewritten to /app/dashboard (the URL
 * stays clean). Each host redirects requests meant for the other one.
 * Local dev uses one origin with NEXT_PUBLIC_CLASSROOM_URL=/app, so this
 * does nothing there.
 */
const CLASSROOM_URL = process.env.NEXT_PUBLIC_CLASSROOM_URL ?? "/app";
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://beyownd.in";

/** First path segments that belong to the app. Keep in sync with src/app/(app)/app/. */
const APP_SECTIONS = new Set([
  "login", "signup", "verify-email", "forgot-password", "reset-password", "onboarding",
  "dashboard", "documents", "payments", "profile", "enroll", "learn", "review", "admin",
]);

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

export function proxy(req: NextRequest) {
  const classroomHost = hostOf(CLASSROOM_URL);
  if (!classroomHost) return NextResponse.next(); // local dev: same origin, /app prefix

  const host = req.headers.get("host");
  const { pathname, search } = req.nextUrl;

  if (host === classroomHost) {
    // Old or hand-typed /app/... links → the clean URL.
    if (pathname === "/app" || pathname.startsWith("/app/")) {
      return NextResponse.redirect(new URL(`${pathname.slice(4) || "/"}${search}`, CLASSROOM_URL), 308);
    }
    if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", CLASSROOM_URL), 307);
    const section = pathname.split("/")[1];
    if (!APP_SECTIONS.has(section)) {
      // A marketing page asked on the app host (e.g. /programs, /verify/...).
      return NextResponse.redirect(new URL(`${pathname}${search}`, MARKETING_URL), 308);
    }
    const url = req.nextUrl.clone();
    url.pathname = `/app${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Marketing host: app routes live on the classroom host.
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return NextResponse.redirect(new URL(`${pathname.slice(4) || "/dashboard"}${search}`, CLASSROOM_URL), 308);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and files with an extension (images, icons, robots.txt, sitemap.xml…).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
