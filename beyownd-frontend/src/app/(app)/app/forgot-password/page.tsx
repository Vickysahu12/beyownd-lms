"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/app/auth-shell";
import { Button, Field, TextInput } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { pendingEmail } from "@/lib/auth-nav";
import { CLASSROOM_URL } from "@/lib/site";

/*
 * Step 1 of reset: ask for the email. The API answers the same way whether
 * or not the account exists (no account enumeration), so the UI does too.
 * Also how Google-only accounts set a password.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError("Enter a valid email address");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: addr }, auth: false });
      pendingEmail.set(addr);
      router.push(`${CLASSROOM_URL}/reset-password`);
    } catch (err) {
      // A cooldown means a code was sent recently: carry on to the code screen.
      if (err instanceof ApiError && err.code === "OTP_COOLDOWN") {
        pendingEmail.set(addr);
        router.push(`${CLASSROOM_URL}/reset-password`);
        return;
      }
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      sub="Enter the email you signed up with. We'll send a 6-digit code to set a new password."
      footer={
        <>
          Remembered it? <Link href={`${CLASSROOM_URL}/login`} className="link-grow text-brand">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Field label="Email" error={error ?? undefined}>
          {(id, d) => <TextInput id={id} aria-describedby={d} type="email" inputMode="email" autoComplete="email" value={email} invalid={!!error} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Button type="submit" loading={busy} disabled={!email} className="w-full">Send code</Button>
      </form>
    </AuthShell>
  );
}
