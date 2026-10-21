"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import { FormError } from "@/components/app/auth-shell";
import { useAuth } from "@/components/app/auth-provider";
import { CollegeCombobox } from "@/components/app/college-combobox";
import { useToast } from "@/components/app/toast";
import { Button, Card, ErrorState, Field, PageTitle, Pill, Select, Skeleton, TextInput } from "@/components/app/ui";
import { ApiError, api, errorMessage, type PublicUser } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";
import { CERTIFICATE_NAME, CURRENT_YEARS, DEGREES, INDIAN_STATES, PERSON_NAME, type Profile } from "@/lib/student-types";

/*
 * Profile. Sends only changed fields (PATCH). The certificate name locks
 * once a document is issued (CERTIFICATE_NAME_LOCKED): shown read-only.
 */
type Me = PublicUser & { profile: Profile | null };

export default function ProfilePage() {
  const q = useQuery({ queryKey: ["me"], queryFn: () => api<{ user: Me }>("/users/me") });
  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-96 max-w-180" /></div>;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <ProfileForm me={q.data.user} />;
}

const fields = ["certificateName", "phone", "college", "degree", "degreeOther", "branch", "currentYear", "graduationYear", "city", "state"] as const;
type F = Record<(typeof fields)[number], string>;
const thisYear = new Date().getFullYear();
const display = (phone: string) => phone.replace(/^\+91/, "");

function ProfileForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { logout } = useAuth();
  const p = me.profile;
  const initial: F = {
    certificateName: p?.certificateName ?? "", phone: display(p?.phone ?? ""), college: p?.collegeName ?? "", degree: p?.degree ?? "", degreeOther: p?.degreeOther ?? "",
    branch: p?.branch ?? "", currentYear: p?.currentYear ?? "", graduationYear: p?.graduationYear ? String(p.graduationYear) : "", city: p?.city ?? "", state: p?.state ?? "",
  };
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Partial<F>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = !!p?.certificateNameLocked;
  const changed = fields.filter((k) => f[k].trim() !== saved[k].trim());

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const check = () => {
    const e: Partial<F> = {};
    const n = f.certificateName.trim();
    if (!locked && (n.length < 2 || n.length > 60 || !CERTIFICATE_NAME.test(n))) e.certificateName = "Use English letters, 2-60 characters";
    let d = f.phone.replace(/[\s\-()]/g, "");
    if (d.startsWith("+91")) d = d.slice(3);
    else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
    if (!/^[6-9]\d{9}$/.test(d)) e.phone = "Enter a valid 10-digit Indian mobile number";
    if (f.college.trim().length < 3) e.college = "Enter your college name";
    if (f.degree === "other" && f.degreeOther.trim().length < 2) e.degreeOther = "Please enter your degree";
    if (f.branch.trim().length < 2) e.branch = "Enter your branch";
    if (f.city.trim().length < 2 || !PERSON_NAME.test(f.city.trim())) e.city = "Enter a valid city name";
    return e;
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local = check();
    setErrors(local);
    setError(null);
    if (Object.keys(local).length || !changed.length) return;
    const body: Record<string, unknown> = {};
    for (const k of changed) body[k] = k === "graduationYear" ? Number(f[k]) : f[k].trim();
    if (body.degree && body.degree !== "other") delete body.degreeOther;
    setBusy(true);
    try {
      await api("/users/me/profile", { method: "PATCH", body });
      setSaved(f);
      qc.invalidateQueries({ queryKey: ["me"] });
      toast("success", "Profile saved.");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      if (e instanceof ApiError && e.errors.length) setErrors(e.fieldErrors() as Partial<F>);
      if (code === "CERTIFICATE_NAME_LOCKED") {
        setF((x) => ({ ...x, certificateName: saved.certificateName }));
        setError("Your certificate name can't be changed because a document has already been issued with it.");
      } else if (code !== "VALIDATION_ERROR") setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof F, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field label={label} error={errors[k]} hint={hint}>
      {(id, d) => <TextInput id={id} aria-describedby={d} value={f[k]} invalid={!!errors[k]} onChange={set(k)} {...extra} />}
    </Field>
  );

  return (
    <>
      <PageTitle title="Profile" sub="This is what goes on your offer letter and certificate." />
      <div className="grid max-w-180 gap-5">
        <Card className="p-5 sm:p-7">
          <form onSubmit={save} noValidate className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {locked ? (
                <Field label="Name on certificate" hint="Locked because a document has been issued with this name. Email us if it's wrong.">
                  {(id, d) => (
                    <div className="relative">
                      <TextInput id={id} aria-describedby={d} value={f.certificateName} readOnly className="bg-canvas pr-10" />
                      <HugeiconsIcon icon={LockIcon} size={16} strokeWidth={1.8} aria-hidden className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                  )}
                </Field>
              ) : (
                input("certificateName", "Name on certificate", { autoComplete: "name" }, "English letters, exactly as it should be printed. Locks once a document is issued.")
              )}
            </div>
            <Field label="WhatsApp number" error={errors.phone}>
              {(id, d) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">+91</span>
                  <TextInput id={id} aria-describedby={d} type="tel" inputMode="tel" value={f.phone} invalid={!!errors.phone} onChange={set("phone")} className="pl-12" />
                </div>
              )}
            </Field>
            {input("city", "City")}
            <Field label="State" error={errors.state} className="sm:col-span-2">
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={f.state} onChange={set("state")}>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              )}
            </Field>
            <Field label="College" error={errors.college} className="sm:col-span-2">
              {(id, d) => <CollegeCombobox id={id} describedBy={d} value={f.college} onChange={(v) => setF((x) => ({ ...x, college: v }))} invalid={!!errors.college} />}
            </Field>
            <Field label="Degree" error={errors.degree}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={f.degree} onChange={set("degree")}>
                  {DEGREES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            {f.degree === "other" ? input("degreeOther", "Your degree") : input("branch", "Branch")}
            {f.degree === "other" ? input("branch", "Branch") : null}
            <Field label="Current year" error={errors.currentYear}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={f.currentYear} onChange={set("currentYear")}>
                  {CURRENT_YEARS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Graduation year" error={errors.graduationYear}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={f.graduationYear} onChange={set("graduationYear")}>
                  {Array.from({ length: 13 }, (_, i) => thisYear - 6 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
              )}
            </Field>
            <div className="sm:col-span-2">
              <FormError>{error}</FormError>
              <div className="flex items-center justify-end gap-3">
                {changed.length ? <span className="text-[13px] text-muted">{changed.length} unsaved {changed.length === 1 ? "change" : "changes"}</span> : null}
                <Button type="submit" loading={busy} disabled={!changed.length}>Save changes</Button>
              </div>
            </div>
          </form>
        </Card>

        <Card className="p-5 sm:p-7">
          <h2 className="text-[17px] tracking-[-0.02em] text-ink">Account</h2>
          <dl className="mt-3 grid gap-2 text-[14px]">
            <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="truncate text-ink">{me.email}</dd></div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Sign-in</dt>
              <dd className="flex gap-1.5">{me.authProviders.map((a) => <Pill key={a}>{a === "local" ? "Password" : a === "google" ? "Google" : a}</Pill>)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`${CLASSROOM_URL}/forgot-password`} className="inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] text-ink ring-1 ring-inset ring-line-strong hover:bg-canvas">
              {me.authProviders.includes("local") ? "Change password" : "Set a password"}
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
