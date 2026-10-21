import { Pill } from "./ui";
import type { SubmissionStatus } from "@/lib/staff-types";

export function StatusPill({ status }: { status: SubmissionStatus | string }) {
  if (status === "approved") return <Pill tone="good">Approved</Pill>;
  if (status === "pending" || status === "pending_review") return <Pill tone="warn">Pending</Pill>;
  if (status === "changes_requested") return <Pill tone="bad">Changes requested</Pill>;
  return <Pill>{status.replace(/_/g, " ")}</Pill>;
}
