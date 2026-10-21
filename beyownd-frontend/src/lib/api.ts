/*
 * Small fetch wrapper for the student/mentor/admin app (BRIEF §10.1).
 *
 * - Access token lives in memory only (never localStorage).
 * - The refresh token is an httpOnly cookie scoped to /api/auth, so every
 *   /auth/* call sends credentials: "include".
 * - On 401 TOKEN_EXPIRED: refresh ONCE and retry. Refresh is single-flight:
 *   if five requests expire together, one /auth/refresh runs and the other
 *   four wait for it (the backend treats reuse of an old refresh token as theft).
 * - Errors are thrown as ApiError; callers branch on `code`, never on `message`.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "mentor" | "admin" | string;
  isVerified: boolean;
  authProviders: string[];
  onboardingCompleted: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors: { field: string; message: string }[] = [],
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
  /** Field errors from express-validator, keyed by field path. */
  fieldErrors() {
    return Object.fromEntries(this.errors.map((e) => [e.field, e.message]));
  }
}

let accessToken: string | null = null;
let onSession: ((user: PublicUser | null) => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
/** The auth provider subscribes so a refresh or logout anywhere updates the UI. */
export const onSessionChange = (fn: typeof onSession) => {
  onSession = fn;
};

async function parse(res: Response) {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || body.success === false) {
    throw new ApiError(
      res.status,
      (body.code as string) ?? (res.status === 0 ? "NETWORK_ERROR" : "UNKNOWN_ERROR"),
      (body.message as string) ?? "Something went wrong. Please try again.",
      (body.errors as ApiError["errors"]) ?? [],
      (body.details as Record<string, unknown>) ?? {},
    );
  }
  return body;
}

/** Single-flight refresh. Resolves true when a new access token was obtained. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
        const body = await parse(res);
        setAccessToken(body.accessToken as string);
        onSession?.(body.user as PublicUser);
        return true;
      } catch {
        setAccessToken(null);
        onSession?.(null);
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

export async function api<T = Record<string, unknown>>(path: string, { body, auth = true, headers, ...init }: Options = {}): Promise<T> {
  const isAuthRoute = path.startsWith("/auth/");
  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: isAuthRoute ? "include" : init.credentials,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach Beyownd right now. Check your connection and try again.");
  }

  if (res.status === 401 && auth && !isAuthRoute) {
    const body = (await res.clone().json().catch(() => ({}))) as { code?: string };
    if (body.code === "TOKEN_EXPIRED" && (await refreshSession())) {
      res = await doFetch();
    }
  }
  return (await parse(res)) as T;
}

/** Human message for an ApiError, with sensible defaults for common codes. */
export function errorMessage(e: unknown) {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.code === "RATE_LIMITED") return "Too many attempts. Please wait a minute and try again.";
  return e.message;
}
