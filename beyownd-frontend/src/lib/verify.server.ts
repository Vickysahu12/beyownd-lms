import { API_URL } from "./catalog.server";

/*
 * Public credential verification (GET /verify/:id). Never cached on our side:
 * a revoked certificate must never show as valid (PAGES.md §3.6).
 */
export interface VerifiedCredential {
  valid: boolean;
  status: "issued" | "generating" | "revoked";
  credentialId: string;
  type: string;
  label: string;
  studentName: string;
  collegeName: string | null;
  courseTitle: string;
  skills: string[];
  cohortName: string;
  startDate: string;
  endDate: string;
  issuedAt: string | null;
  issuedBy: string;
  programName: string;
  revokedAt: string | null;
}

export type VerifyResult = { kind: "found"; credential: VerifiedCredential } | { kind: "not_found" } | { kind: "error" };

export async function verifyCredential(id: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${API_URL}/verify/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; code?: string; credential?: VerifiedCredential };
    if (res.ok && body.credential) return { kind: "found", credential: body.credential };
    if (body.code === "CREDENTIAL_NOT_FOUND" || res.status === 404) return { kind: "not_found" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
