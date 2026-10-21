"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, type PublicUser } from "@/lib/api";
import { useAuth } from "./auth-provider";

/*
 * "Continue with Google" via Google Identity Services. The GIS script loads
 * only on auth pages, once. Google returns an ID token, which goes to
 * POST /auth/google; the backend verifies it and links accounts by email.
 * Without NEXT_PUBLIC_GOOGLE_CLIENT_ID the button simply isn't shown.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type Gis = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: "popup"; context?: string }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};
declare global {
  interface Window {
    google?: Gis;
  }
}

let loader: Promise<Gis> | null = null;
function loadGis() {
  if (window.google?.accounts) return Promise.resolve(window.google);
  loader ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error("gis")));
    s.onerror = () => {
      loader = null;
      reject(new Error("gis"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

const messages: Record<string, string> = {
  GOOGLE_TOKEN_INVALID: "Google sign-in didn't go through. Please try again.",
  GOOGLE_EMAIL_UNVERIFIED: "Your Google email isn't verified. Verify it with Google, or sign up with email instead.",
  RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
};

export function GoogleButton({ context = "signin", onDone, onError }: { context?: "signin" | "signup"; onDone: (u: PublicUser) => void; onError: (msg: string | null) => void }) {
  const { loginWithGoogle } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Keep the latest callbacks without re-rendering Google's button.
  const cb = useRef({ onDone, onError, loginWithGoogle });
  useEffect(() => {
    cb.current = { onDone, onError, loginWithGoogle };
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let alive = true;
    loadGis()
      .then((g) => {
        if (!alive || !box.current) return;
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: "popup",
          context,
          callback: async ({ credential }) => {
            if (!credential) return;
            cb.current.onError(null);
            setBusy(true);
            try {
              cb.current.onDone(await cb.current.loginWithGoogle(credential));
            } catch (e) {
              const code = e instanceof ApiError ? e.code : "";
              cb.current.onError(messages[code] ?? (e instanceof Error ? e.message : "Google sign-in failed. Please try again."));
            } finally {
              setBusy(false);
            }
          },
        });
        g.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: context === "signup" ? "signup_with" : "continue_with",
          logo_alignment: "center",
          width: Math.min(box.current.clientWidth || 356, 400),
        });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [context]);

  if (!CLIENT_ID) return null;
  if (failed) return <p className="text-center text-[13px] text-muted">Google sign-in couldn&apos;t load. Use your email instead.</p>;
  return (
    <div aria-busy={busy || undefined} className={busy ? "pointer-events-none opacity-60" : undefined}>
      {/* Reserved height so the form doesn't jump when Google's iframe appears. */}
      <div ref={box} className="flex h-11 w-full justify-center overflow-hidden rounded-full" />
    </div>
  );
}
