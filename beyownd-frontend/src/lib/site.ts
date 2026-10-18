/**
 * Where the student app lives. In production this is https://classroom.beyownd.in;
 * in local dev the app runs on the same origin under /app (brief §9).
 */
export const CLASSROOM_URL = process.env.NEXT_PUBLIC_CLASSROOM_URL ?? "/app";

export const links = {
  signup: `${CLASSROOM_URL}/signup`,
  login: `${CLASSROOM_URL}/login`,
  programs: "/#programs",
  verify: "/#verify",
} as const;

export const navItems = [
  { label: "Programs", href: "/#programs" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Certificates", href: "/#certificates" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;
