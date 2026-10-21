"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, FormError, FormNote } from "@/components/app/auth-shell";
import { OtpInput } from "@/components/app/otp-input";
import { PasswordField, passwordOk } from "@/components/app/password-field";
import { useToast } from "@/components/app/toast";
import { Button, Field, TextInput } from "@/components/app/ui";
import { useCountdown } from "@/components/app/use-countdown";
import { ApiError, api, errorMessage } from "@/lib/api";
import { pendingEmail } from "@/lib/auth-nav";
import { CLASSROOM_URL } from "@/lib/site";

/*
 * Step 2 of reset: code + new password. Success logs out every other device
 * (the backend revokes all sessions), then the student logs in again.
 */
const RESEND_SECONDS = 60;

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [known] = useState(() => pendingEmail.get());
  const [email, setEmail] = useState(known);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<React.ReactNode>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, startCountdown] = useCountdown(known ? RESEND_SECONDS : 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOk(password)) return setErrors({ password: "Password doesn't meet all the rules below" });
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api("/auth/reset-password", { method: "POST", body: { email: email.trim().toLowerCase(), otp, password }, auth: false });
      pendingEmail.clear();
      toast("success", "Password changed. Log in with your new password.");
      router.replace(`${CLASSROOM_URL}/login`);
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "";
      if (err instanceof ApiError && err.errors.length) setErrors(err.fieldErrors());
      if (c === "OTP_INVALID") {
        setOtp("");
        setError("That code is wrong or has expired. Check the latest email, or send a new code.");
      } else if (c === "OTP_LOCKED") {
        setOtp("");
        setError("Too many wrong tries. Send a new code to continue.");
      } else if (c !== "VALIDATION_ERROR") setError(errorMessage(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNote(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim().toLowerCase() }, auth: false });
      setNote("If an account exists for this email, a new code is on its way.");
      startCountdown(RESEND_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.code === "OTP_COOLDOWN") startCountdown(RESEND_SECONDS);
      else setError(errorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      sub={
        known ? (
          <>
            If <b className="font-medium text-ink">{known}</b> has an account, we&apos;ve sent it a 6-digit code.
          </>
        ) : (
          "Enter your email, the 6-digit code we sent, and a new password."
        )
      }
      footer={<Link href={`${CLASSROOM_URL}/login`} className="link-grow text-brand">Back to log in</Link>}
    >
      <form onSubmit={submit} noValidate>
        {!known ? (
          <Field label="Email" error={errors.email}>
            {(id, d) => <TextInput id={id} aria-describedby={d} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        ) : null}
        <p className="mb-2 text-[14px] text-ink-soft">Code</p>
        <OtpInput value={otp} onChange={setOtp} invalid={!!errors.otp} />
        <p className="mb-4 mt-2 text-[13px] text-muted" aria-live="polite">
          {left > 0 ? (
            <span className="tabular-nums">New code in {left}s</span>
          ) : (
            <button type="button" onClick={resend} disabled={!email} className="link-grow text-brand disabled:opacity-50">Send a new code</button>
          )}
        </p>
        <PasswordField label="New password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" showRules />
        <FormError>{error}</FormError>
        <FormNote>{note}</FormNote>
        <Button type="submit" loading={busy} disabled={otp.length !== 6 || !email || !password} className="w-full">Change password</Button>
      </form>
    </AuthShell>
  );
}
