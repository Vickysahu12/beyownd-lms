/**
 * Where the student app lives. In production this is https://classroom.beyownd.in;
 * in local dev the app runs on the same origin under /app (PAGES.md §1).
 * Every link between the two surfaces goes through here.
 */
export const CLASSROOM_URL = process.env.NEXT_PUBLIC_CLASSROOM_URL ?? "/app";

/** Public marketing origin, used for canonical URLs, sitemap and JSON-LD. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://beyownd.in";

export const links = {
  signup: `${CLASSROOM_URL}/signup`,
  login: `${CLASSROOM_URL}/login`,
  programs: "/programs",
  verify: "/verify",
  forColleges: "/for-colleges",
  faq: "/faq",
  about: "/about",
  contact: "/contact",
} as const;

/** Signup that returns the student to a target after login (PAGES.md §3.3). */
export const signupNext = (next: string) => `${links.signup}?next=${encodeURIComponent(next)}`;
export const enrollUrl = (slug: string, cohortId: string) => `${CLASSROOM_URL}/enroll/${slug}/${cohortId}`;

export const navItems = [
  { label: "Programs", href: "/programs" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Certificates", href: "/verify" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/faq" },
] as const;

export const CONTACT_EMAIL = "hello@beyownd.in";
