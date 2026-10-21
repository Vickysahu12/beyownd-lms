"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, OrDivider, useGuestOnly } from "@/components/app/auth-shell";
import { GoogleButton } from "@/components/app/google-button";
import { PasswordField, passwordOk } from "@/components/app/password-field";
import { Button, Field, TextInput } from "@/components/app/ui";
import { ApiError, api, errorMessage, type PublicUser } from "@/lib/api";
import { afterAuth, pendingEmail, safeNext, withNext } from "@/lib/auth-nav";
import { CLASSROOM_URL } from "@/lib/site";

/* Name, email, password (or Google) → a 6-digit code is emailed → /verify-email. */
const NAME = /^[\p{L}\p{M} .'-]+$/u;

export default function SignupPage() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);
  useGuestOnly(next);

  const login = withNext(`${CLASSROOM_URL}/login`, next);
  const done = (u: PublicUser) => router.replace(afterAuth(u, next));

  const check = () => {
    const e: Record<string, string> = {};
    const name = f.name.trim();
    if (name.length < 2 || name.length > 60) e.name = "Name must be 2-60 characters";
    else if (!NAME.test(name)) e.name = "Name can only contain letters, spaces, . ' -";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
    if (!passwordOk(f.password)) e.password = "Password doesn't meet all the rules below";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local = check();
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    const email = f.email.trim().toLowerCase();
    try {
      await api("/auth/signup", { method: "POST", body: { name: f.name.trim(), email, password: f.password }, auth: false });
      pendingEmail.set(email);
      router.push(withNext(`${CLASSROOM_URL}/verify-email`, next));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      if (code === "EMAIL_TAKEN")
        setError(
          <>
            This email already has an account. <Link href={login} className="underline">Log in</Link> instead.
          </>,
        );
      else if (code === "GOOGLE_ACCOUNT")
        setError(
          <>
            This email signs in with Google. Use the Google button above, or{" "}
            <Link href={`${CLASSROOM_URL}/forgot-password`} className="underline">set a password</Link>.
          </>,
        );
      else if (code !== "VALIDATION_ERROR") setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  return (
    <AuthShell
      title="Create your account"
      sub="Free to sign up. You only pay when you join a batch."
      footer={
        <>
          Already have an account? <Link href={login} className="link-grow text-brand">Log in</Link>
        </>
      }
    >
      <GoogleButton context="signup" onDone={done} onError={setError} />
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? <OrDivider /> : null}
      <form onSubmit={submit} noValidate>
        <Field label="Full name" error={errors.name}>
          {(id, d) => <TextInput id={id} aria-describedby={d} autoComplete="name" value={f.name} invalid={!!errors.name} onChange={(e) => set("name")(e.target.value)} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(id, d) => <TextInput id={id} aria-describedby={d} type="email" inputMode="email" autoComplete="email" value={f.email} invalid={!!errors.email} onChange={(e) => set("email")(e.target.value)} />}
        </Field>
        <PasswordField value={f.password} onChange={set("password")} error={errors.password} autoComplete="new-password" showRules />
        <FormError>{error}</FormError>
        <Button type="submit" loading={busy} className="mt-1 w-full">Create account</Button>
        <p className="mt-4 text-center text-[12.5px] leading-snug text-muted">
          By signing up you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
