"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, onSessionChange, refreshSession, setAccessToken, type PublicUser } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { ToastProvider } from "./toast";

/*
 * Session state for the app. On load: POST /auth/refresh once.
 * Success → logged in; 401 → logged out (BRIEF §10.1).
 */
type Status = "loading" | "authenticated" | "anonymous";
type Ctx = {
  user: PublicUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<PublicUser>;
  loginWithGoogle: (idToken: string) => Promise<PublicUser>;
  /** For flows that return a session themselves (OTP verify). */
  setSession: (user: PublicUser, accessToken: string) => void;
  /** After onboarding/profile changes, without a new token. */
  updateUser: (patch: Partial<PublicUser>) => void;
  logout: () => Promise<void>;
};
type AuthBody = { user: PublicUser; accessToken: string };

const AuthContext = createContext<Ctx | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Don't retry errors the user can't fix by waiting.
            retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    onSessionChange((u) => {
      setUser(u);
      setStatus(u ? "authenticated" : "anonymous");
    });
    refreshSession();
    return () => onSessionChange(null);
  }, []);

  const setSession = useCallback((u: PublicUser, token: string) => {
    setAccessToken(token);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const body = await api<AuthBody>("/auth/login", { method: "POST", body: { email, password }, auth: false });
      setSession(body.user, body.accessToken);
      return body.user;
    },
    [setSession],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const body = await api<AuthBody>("/auth/google", { method: "POST", body: { idToken }, auth: false });
      setSession(body.user, body.accessToken);
      return body.user;
    },
    [setSession],
  );

  const updateUser = useCallback((patch: Partial<PublicUser>) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST", auth: false }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, loginWithGoogle, setSession, updateUser, logout }),
    [user, status, login, loginWithGoogle, setSession, updateUser, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AppProviders");
  return ctx;
}
