import type { PublicUser } from "./api";
import { CLASSROOM_URL } from "./site";

/*
 * Where auth pages send people, and the email being verified between steps.
 * The pending email lives in sessionStorage (not the URL) so it doesn't end
 * up in browser history or server logs; pages still work without it.
 */

/** Only same-app relative paths are allowed as ?next= (no open redirect). */
export function safeNext(raw: string | null | undefined) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : null;
}

export function homeFor(user: PublicUser) {
  if (user.role === "admin") return `${CLASSROOM_URL}/admin`;
  if (user.role === "mentor") return `${CLASSROOM_URL}/review`;
  return user.onboardingCompleted ? `${CLASSROOM_URL}/dashboard` : `${CLASSROOM_URL}/onboarding`;
}

/** After login: students who haven't onboarded go there first, keeping `next` for later. */
export function afterAuth(user: PublicUser, next: string | null) {
  if (user.role === "student" && !user.onboardingCompleted) {
    return `${CLASSROOM_URL}/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  }
  return next ?? homeFor(user);
}

/** Appends ?next= to an app path when there is one. */
export const withNext = (path: string, next: string | null) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

const KEY = "beyownd:pending-email";
export const pendingEmail = {
  get(): string {
    try {
      return sessionStorage.getItem(KEY) ?? "";
    } catch {
      return "";
    }
  },
  set(email: string) {
    try {
      sessionStorage.setItem(KEY, email);
    } catch {
      /* private mode: the page asks for the email instead */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
