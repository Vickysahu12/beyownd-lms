"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, FormNote, useGuestOnly } from "@/components/app/auth-shell";
import { useAuth } from "@/components/app/auth-provider";
import { OtpInput } from "@/components/app/otp-input";
import { Button, Field, TextInput } from "@/components/app/ui";
import { useCountdown } from "@/components/app/use-countdown";
import { ApiError, api, errorMessage, type PublicUser } from "@/lib/api";
import { afterAuth, pendingEmail, safeNext, withNext } from "@/lib/auth-nav";
import { CLASSROOM_URL } from "@/lib/site";

/*
 * 6-digit email code. Auto-submits on the 6th digit; paste works. Resend has
 * a 60 s countdown matching the backend's OTP_COOLDOWN. On success the API
 * returns a session, so the student lands logged in.
 */
const RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  const { setSession } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [known] = useState(() => pendingEmail.get());
  const [email, setEmail] = useState(known);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  // Just came from signup/login, where a code was sent: start the countdown.
  const [left, startCountdown] = useCountdown(known ? RESEND_SECONDS : 0);
  useGuestOnly(next);

  const verify = async (code: string) => {
    if (busy || locked) return;
    setBusy(true);
    setError(null);
    try {
      const body = await api<{ user: PublicUser; accessToken: string }>("/auth/verify-otp", { method: "POST", body: { email: email.trim().toLowerCase(), otp: code }, auth: false });
      pendingEmail.clear();
      setSession(body.user, body.accessToken);
      router.replace(afterAuth(body.user, next));
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "";
      setOtp("");
      if (c === "OTP_INVALID") setError("That code is wrong or has expired. Check the latest email, or send a new code.");
      else if (c === "OTP_LOCKED") {
        setLocked(true);
        setError("Too many wrong tries. Send a new code to continue.");
      } else setError(errorMessage(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNote(null);
    try {
      await api("/auth/resend-otp", { method: "POST", body: { email: email.trim().toLowerCase() }, auth: false });
      pendingEmail.set(email.trim().toLowerCase());
      setLocked(false);
      setOtp("");
      setNote("If this email has an unverified account, a new code is on its way. It's valid for 10 minutes.");
      startCountdown(RESEND_SECONDS);
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "";
      if (c === "OTP_COOLDOWN") {
        startCountdown(RESEND_SECONDS);
        setError("Please wait a moment before asking for another code.");
      } else setError(errorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Check your email"
      sub={
        known ? (
          <>
            We sent a 6-digit code to <b className="font-medium text-ink">{known}</b>. It expires in 10 minutes.
          </>
        ) : (
          "Enter your email and the 6-digit code we sent you."
        )
      }
      footer={
        <>
          Wrong email? <Link href={withNext(`${CLASSROOM_URL}/signup`, next)} className="link-grow text-brand">Sign up again</Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (otp.length === 6) verify(otp);
        }}
      >
        {!known ? (
          <Field label="Email">
            {(id, d) => <TextInput id={id} aria-describedby={d} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        ) : null}
        <OtpInput value={otp} onChange={setOtp} onComplete={(c) => email && verify(c)} invalid={!!error} disabled={busy || locked} />
        <div className="mt-5">
          <FormError>{error}</FormError>
          <FormNote>{note}</FormNote>
        </div>
        <Button type="submit" loading={busy} disabled={otp.length !== 6 || !email || locked} className="w-full">Verify email</Button>
      </form>
      <p className="mt-4 text-center text-[14px] text-muted" aria-live="polite">
        Didn&apos;t get it? Check spam, or{" "}
        {left > 0 ? (
          <span className="tabular-nums">send a new code in {left}s</span>
        ) : (
          <button type="button" onClick={resend} disabled={!email} className="link-grow text-brand disabled:opacity-50">send a new code</button>
        )}
      </p>
    </AuthShell>
  );
}
