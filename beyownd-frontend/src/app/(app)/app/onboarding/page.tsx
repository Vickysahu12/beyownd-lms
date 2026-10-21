"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { FormError } from "@/components/app/auth-shell";
import { useAuth } from "@/components/app/auth-provider";
import { CollegeCombobox } from "@/components/app/college-combobox";
import { RequireRole } from "@/components/app/guard";
import { useToast } from "@/components/app/toast";
import { Button, Field, Select, TextInput } from "@/components/app/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { homeFor, safeNext } from "@/lib/auth-nav";
import {
  CERTIFICATE_NAME, CURRENT_YEARS, DEGREES, GOALS, HEARD_FROM, INDIAN_STATES, INTEREST_AREAS, MAX_INTERESTS, PERSON_NAME, SKILL_LEVELS,
} from "@/lib/student-types";
import { cn } from "@/lib/utils";

/*
 * Two short steps (user-flow.md §4): about you, then your goal. A draft is
 * kept in localStorage between steps and reloads. Field errors from the API
 * (`errors[]`) jump back to the step that has them.
 */
export default function OnboardingPage() {
  return (
    <RequireRole>
      <Onboarding />
    </RequireRole>
  );
}

const STEP1 = ["certificateName", "phone", "college", "degree", "degreeOther", "branch", "currentYear", "graduationYear", "city", "state"] as const;
type Form = {
  certificateName: string; phone: string; college: string; degree: string; degreeOther: string; branch: string; currentYear: string;
  graduationYear: string; city: string; state: string; goal: string; certificateNeededBy: string; interestedTracks: string[];
  skillLevel: string; heardFrom: string; heardFromOther: string; referralCode: string;
};
const blank = (name: string): Form => ({
  certificateName: CERTIFICATE_NAME.test(name) ? name : "", phone: "", college: "", degree: "", degreeOther: "", branch: "", currentYear: "",
  graduationYear: "", city: "", state: "", goal: "", certificateNeededBy: "", interestedTracks: [], skillLevel: "", heardFrom: "", heardFromOther: "", referralCode: "",
});

const thisYear = new Date().getFullYear();
const gradYears = Array.from({ length: 13 }, (_, i) => thisYear - 6 + i);
const phoneDigits = (raw: string) => {
  let d = raw.replace(/[\s\-()]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d;
};

function validate(f: Form, step: 1 | 2) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (step === 1) {
    const n = f.certificateName.trim();
    if (n.length < 2 || n.length > 60) e.certificateName = "Name must be 2-60 characters";
    else if (!CERTIFICATE_NAME.test(n)) e.certificateName = "Use English letters, as it should appear on the certificate";
    if (!/^[6-9]\d{9}$/.test(phoneDigits(f.phone))) e.phone = "Enter a valid 10-digit Indian mobile number";
    const c = f.college.trim();
    if (c.length < 3 || c.length > 150 || !/\p{L}/u.test(c)) e.college = "Enter your college name (3-150 characters)";
    if (!f.degree) e.degree = "Select your degree";
    if (f.degree === "other" && f.degreeOther.trim().length < 2) e.degreeOther = "Please enter your degree";
    if (f.branch.trim().length < 2) e.branch = "Enter your branch, e.g. CSE";
    if (!f.currentYear) e.currentYear = "Select your current year";
    if (!f.graduationYear) e.graduationYear = "Select your graduation year";
    if (f.city.trim().length < 2 || !PERSON_NAME.test(f.city.trim())) e.city = "Enter a valid city name";
    if (!f.state) e.state = "Select your state";
  } else {
    if (!f.goal) e.goal = "Pick the one that fits best";
    if (!f.interestedTracks.length) e.interestedTracks = `Pick 1-${MAX_INTERESTS} areas`;
    if (!f.skillLevel) e.skillLevel = "Select your current level";
    if (!f.heardFrom) e.heardFrom = "Select how you heard about us";
    if (f.heardFrom === "other" && f.heardFromOther.trim().length < 2) e.heardFromOther = "Tell us where you heard about us";
    if (f.referralCode && !/^[A-Za-z0-9_-]{3,30}$/.test(f.referralCode.trim())) e.referralCode = "Referral codes are 3-30 letters or numbers";
  }
  return e;
}

function Onboarding() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const next = safeNext(useSearchParams().get("next"));
  const draftKey = `beyownd:onboarding:${user?.id}`;
  const [f, setF] = useState<Form>(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return { ...blank(user?.name ?? ""), ...(JSON.parse(saved) as Partial<Form>) };
    } catch {
      /* no storage: start fresh */
    }
    return blank(user?.name ?? "");
  });
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const top = useRef<HTMLHeadingElement>(null);

  // Already onboarded (e.g. back button): nothing to do here.
  useEffect(() => {
    if (user?.onboardingCompleted) router.replace(next ?? homeFor(user));
  }, [user, next, router]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(f));
    } catch {
      /* ignore */
    }
  }, [f, draftKey]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const text = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const go = (s: 1 | 2) => {
    setStep(s);
    requestAnimationFrame(() => {
      top.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const continueStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(f, 1);
    setErrors(v);
    if (Object.keys(v).length) return focusFirstError();
    go(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(f, 2);
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return focusFirstError();
    setBusy(true);
    const trim = (s: string) => s.trim() || undefined;
    try {
      await api("/users/me/onboarding", {
        method: "PUT",
        body: {
          certificateName: f.certificateName.trim(),
          phone: f.phone,
          college: f.college.trim(),
          degree: f.degree,
          degreeOther: f.degree === "other" ? trim(f.degreeOther) : undefined,
          branch: f.branch.trim(),
          currentYear: f.currentYear,
          graduationYear: Number(f.graduationYear),
          city: f.city.trim(),
          state: f.state,
          goal: f.goal,
          certificateNeededBy: f.certificateNeededBy || undefined,
          interestedTracks: f.interestedTracks,
          skillLevel: f.skillLevel,
          heardFrom: f.heardFrom,
          heardFromOther: f.heardFrom === "other" ? trim(f.heardFromOther) : undefined,
          referralCode: trim(f.referralCode),
        },
      });
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      toast("success", "You're all set.");
      updateUser({ onboardingCompleted: true }); // the effect above redirects
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_ONBOARDED") {
        updateUser({ onboardingCompleted: true });
        return;
      }
      if (err instanceof ApiError && err.errors.length) {
        const fe = err.fieldErrors() as Partial<Record<keyof Form, string>>;
        // interestedTracks.0 → interestedTracks
        for (const k of Object.keys(fe)) if (k.includes(".")) fe[k.split(".")[0] as keyof Form] = fe[k as keyof Form];
        setErrors(fe);
        if (STEP1.some((k) => fe[k])) go(1);
        setFormError("Please fix the highlighted fields.");
      } else setFormError(errorMessage(err));
      setBusy(false);
    }
  };

  const focusFirstError = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus());

  return (
    <main id="main" className="min-h-dvh bg-canvas px-4 pb-16 pt-8">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark className="size-7" />
            <span className="text-[17px] font-semibold tracking-[-0.04em] text-ink">Beyownd</span>
          </Link>
          <p className="text-[13px] text-muted" aria-live="polite">Step {step} of 2</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1.5" aria-hidden>
          <span className="h-1.5 rounded-full bg-brand" />
          <span className={cn("h-1.5 rounded-full transition-colors duration-300", step === 2 ? "bg-brand" : "bg-line")} />
        </div>

        <div className="mt-6 rounded-[24px] bg-white p-6 shadow-[var(--shadow-board)] ring-1 ring-line sm:p-8">
          <h1 ref={top} tabIndex={-1} className="text-[26px] font-light tracking-[-0.03em] text-ink outline-none sm:text-[30px]">
            {step === 1 ? "About you" : "What you're here for"}
          </h1>
          <p className="mt-1 text-[14.5px] text-muted">
            {step === 1 ? "This goes on your offer letter and certificate, so please be exact." : "Helps us suggest the right program and batch. Takes 20 seconds."}
          </p>

          {step === 1 ? (
            <form onSubmit={continueStep1} noValidate className="mt-6 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Name on certificate" error={errors.certificateName} hint="English letters, exactly as it should be printed. It can't be changed once a document is issued." className="sm:col-span-2">
                {(id, d) => <TextInput id={id} aria-describedby={d} autoComplete="name" value={f.certificateName} invalid={!!errors.certificateName} onChange={text("certificateName")} />}
              </Field>
              <Field label="WhatsApp number" error={errors.phone} hint="Batch updates come here. We don't share it.">
                {(id, d) => (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">+91</span>
                    <TextInput id={id} aria-describedby={d} type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} invalid={!!errors.phone} onChange={text("phone")} className="pl-12" placeholder="98765 43210" />
                  </div>
                )}
              </Field>
              <Field label="City" error={errors.city}>
                {(id, d) => <TextInput id={id} aria-describedby={d} autoComplete="address-level2" value={f.city} invalid={!!errors.city} onChange={text("city")} />}
              </Field>
              <Field label="State" error={errors.state} className="sm:col-span-2">
                {(id, d) => (
                  <Select id={id} aria-describedby={d} value={f.state} invalid={!!errors.state} onChange={text("state")}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="College" error={errors.college} hint="Pick from the list or type the full name." className="sm:col-span-2">
                {(id, d) => <CollegeCombobox id={id} describedBy={d} value={f.college} onChange={(v) => set("college", v)} invalid={!!errors.college} />}
              </Field>
              <Field label="Degree" error={errors.degree}>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} value={f.degree} invalid={!!errors.degree} onChange={text("degree")}>
                    <option value="">Select degree</option>
                    {DEGREES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                )}
              </Field>
              {f.degree === "other" ? (
                <Field label="Your degree" error={errors.degreeOther}>
                  {(id, d) => <TextInput id={id} aria-describedby={d} value={f.degreeOther} invalid={!!errors.degreeOther} onChange={text("degreeOther")} />}
                </Field>
              ) : (
                <Field label="Branch" error={errors.branch} hint="e.g. CSE, IT, ECE">
                  {(id, d) => <TextInput id={id} aria-describedby={d} value={f.branch} invalid={!!errors.branch} onChange={text("branch")} />}
                </Field>
              )}
              {f.degree === "other" ? (
                <Field label="Branch" error={errors.branch} hint="e.g. CSE, IT, ECE" className="sm:col-span-2">
                  {(id, d) => <TextInput id={id} aria-describedby={d} value={f.branch} invalid={!!errors.branch} onChange={text("branch")} />}
                </Field>
              ) : null}
              <Segmented label="Current year" value={f.currentYear} options={CURRENT_YEARS} onChange={(v) => set("currentYear", v)} error={errors.currentYear} className="sm:col-span-2" />
              <Field label="Graduation year" error={errors.graduationYear}>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} value={f.graduationYear} invalid={!!errors.graduationYear} onChange={text("graduationYear")}>
                    <option value="">Select year</option>
                    {gradYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </Select>
                )}
              </Field>
              <div className="mt-2 flex justify-end sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">Continue</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit} noValidate className="mt-6 grid gap-1">
              <ChoiceCards label="Your main goal" value={f.goal} options={GOALS} onChange={(v) => set("goal", v)} error={errors.goal} />
              <fieldset className="mb-1">
                <legend className="text-[14px] text-ink-soft">What do you want to learn? <span className="text-muted">Pick up to {MAX_INTERESTS}</span></legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INTEREST_AREAS.map(([v, l]) => {
                    const on = f.interestedTracks.includes(v);
                    const full = !on && f.interestedTracks.length >= MAX_INTERESTS;
                    return (
                      <label key={v} className={cn("cursor-pointer rounded-full px-3.5 py-2 text-[14px] ring-1 transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand", on ? "bg-brand-wash text-brand ring-brand" : "bg-white text-ink-soft ring-line-strong hover:bg-canvas", full && "cursor-not-allowed opacity-45")}>
                        <input type="checkbox" className="sr-only" checked={on} disabled={full} aria-invalid={!!errors.interestedTracks || undefined} onChange={() => set("interestedTracks", on ? f.interestedTracks.filter((x) => x !== v) : [...f.interestedTracks, v])} />
                        {l}
                      </label>
                    );
                  })}
                </div>
                <p className={cn("mt-1.5 min-h-[18px] text-[12.5px]", errors.interestedTracks ? "text-[#b42335]" : "text-muted")}>{errors.interestedTracks ?? ""}</p>
              </fieldset>
              <ChoiceCards label="Where are you right now?" value={f.skillLevel} options={SKILL_LEVELS} onChange={(v) => set("skillLevel", v)} error={errors.skillLevel} />
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <Field label="When does your college need the certificate?" error={errors.certificateNeededBy} hint="Optional. Helps us plan batches." className="sm:col-span-2">
                  {(id, d) => <TextInput id={id} aria-describedby={d} type="month" min={`${thisYear - 1}-01`} max={`${thisYear + 3}-12`} value={f.certificateNeededBy} invalid={!!errors.certificateNeededBy} onChange={text("certificateNeededBy")} className="sm:max-w-[260px]" />}
                </Field>
                <Field label="How did you hear about us?" error={errors.heardFrom}>
                  {(id, d) => (
                    <Select id={id} aria-describedby={d} value={f.heardFrom} invalid={!!errors.heardFrom} onChange={text("heardFrom")}>
                      <option value="">Select one</option>
                      {HEARD_FROM.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  )}
                </Field>
                {f.heardFrom === "other" ? (
                  <Field label="Where?" error={errors.heardFromOther}>
                    {(id, d) => <TextInput id={id} aria-describedby={d} value={f.heardFromOther} invalid={!!errors.heardFromOther} onChange={text("heardFromOther")} />}
                  </Field>
                ) : (
                  <Field label="Referral code" error={errors.referralCode} hint="Optional">
                    {(id, d) => <TextInput id={id} aria-describedby={d} value={f.referralCode} invalid={!!errors.referralCode} onChange={text("referralCode")} className="uppercase" />}
                  </Field>
                )}
                {f.heardFrom === "other" ? (
                  <Field label="Referral code" error={errors.referralCode} hint="Optional">
                    {(id, d) => <TextInput id={id} aria-describedby={d} value={f.referralCode} invalid={!!errors.referralCode} onChange={text("referralCode")} className="uppercase" />}
                  </Field>
                ) : null}
              </div>
              <FormError>{formError}</FormError>
              <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => go(1)}>Back</Button>
                <Button type="submit" loading={busy}>Finish</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function Segmented({ label, value, options, onChange, error, className }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (v: string) => void; error?: string; className?: string }) {
  return (
    <fieldset data-invalid={!!error || undefined} className={cn("mb-1", className)}>
      <legend className="text-[14px] text-ink-soft">{label}</legend>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {options.map(([v, l]) => (
          <label key={v} className={cn("grid h-11 cursor-pointer place-items-center rounded-input px-2 text-center text-[14px] ring-1 transition-[background-color,box-shadow] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand", value === v ? "bg-brand-wash text-brand ring-brand" : "bg-white text-ink-soft ring-line-strong hover:bg-canvas")}>
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {l}
          </label>
        ))}
      </div>
      <p className={cn("mt-1.5 min-h-[18px] text-[12.5px]", error ? "text-[#b42335]" : "text-muted")}>{error ?? ""}</p>
    </fieldset>
  );
}

function ChoiceCards({ label, value, options, onChange, error }: { label: string; value: string; options: readonly (readonly [string, string, string])[]; onChange: (v: string) => void; error?: string }) {
  return (
    <fieldset data-invalid={!!error || undefined} className="mb-1">
      <legend className="text-[14px] text-ink-soft">{label}</legend>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map(([v, l, d]) => (
          <label key={v} className={cn("cursor-pointer rounded-2xl p-3.5 ring-1 transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand", value === v ? "bg-brand-wash ring-brand" : "bg-white ring-line-strong hover:bg-canvas")}>
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            <span className={cn("block text-[14.5px] leading-snug", value === v ? "text-brand" : "text-ink")}>{l}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{d}</span>
          </label>
        ))}
      </div>
      <p className={cn("mt-1.5 min-h-[18px] text-[12.5px]", error ? "text-[#b42335]" : "text-muted")}>{error ?? ""}</p>
    </fieldset>
  );
}
