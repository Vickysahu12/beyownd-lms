"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, OrDivider, useGuestOnly } from "@/components/app/auth-shell";
import { useAuth } from "@/components/app/auth-provider";
import { GoogleButton } from "@/components/app/google-button";
import { PasswordField } from "@/components/app/password-field";
import { Button, Field, TextInput } from "@/components/app/ui";
import { ApiError, api, type PublicUser } from "@/lib/api";
import { afterAuth, pendingEmail, safeNext, withNext } from "@/lib/auth-nav";
import { CLASSROOM_URL } from "@/lib/site";

/* Email + password or Google. Branches on the API error `code` (PAGES.md §4). */
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);
  useGuestOnly(next);

  const done = (u: PublicUser) => router.replace(afterAuth(u, next));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const addr = email.trim().toLowerCase();
    try {
      done(await login(addr, password));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "EMAIL_NOT_VERIFIED") {
        // Password was right; send a fresh code and go to the OTP screen.
        pendingEmail.set(addr);
        await api("/auth/resend-otp", { method: "POST", body: { email: addr }, auth: false }).catch(() => undefined);
        router.push(withNext(`${CLASSROOM_URL}/verify-email`, next));
        return;
      }
      if (code === "INVALID_CREDENTIALS") setError("That email and password don't match. Check them and try again.");
      else if (code === "USE_GOOGLE_SIGNIN")
        setError(
          <>
            This account uses Google sign-in. Continue with Google above, or{" "}
            <Link href={`${CLASSROOM_URL}/forgot-password`} className="underline">set a password</Link>.
          </>,
        );
      else if (code === "RATE_LIMITED") setError("Too many attempts. Please wait a minute and try again.");
      else setError(err instanceof Error ? err.message : "Couldn't log you in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      sub="Welcome back to your classroom."
      footer={
        <>
          New here? <Link href={withNext(`${CLASSROOM_URL}/signup`, next)} className="link-grow text-brand">Create a free account</Link>
        </>
      }
    >
      <GoogleButton onDone={done} onError={setError} />
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? <OrDivider /> : null}
      <form onSubmit={submit} noValidate>
        <Field label="Email">
          {(id, d) => <TextInput id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <PasswordField value={password} onChange={setPassword} />
        <p className="-mt-2 mb-4 text-right text-[13.5px]">
          <Link href={`${CLASSROOM_URL}/forgot-password`} className="link-grow text-brand">Forgot password?</Link>
        </p>
        <FormError>{error}</FormError>
        <Button type="submit" loading={busy} disabled={!email || !password} className="w-full">Log in</Button>
      </form>
    </AuthShell>
  );
}
