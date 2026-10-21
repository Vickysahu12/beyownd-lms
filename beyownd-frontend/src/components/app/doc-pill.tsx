import type { MyCredential } from "@/lib/student-types";
import { Pill } from "./ui";

export function DocPill({ status }: { status: MyCredential["status"] }) {
  if (status === "issued") return <Pill tone="good">Ready</Pill>;
  if (status === "revoked") return <Pill tone="bad">Revoked</Pill>;
  return <Pill tone="warn">Being prepared</Pill>;
}
