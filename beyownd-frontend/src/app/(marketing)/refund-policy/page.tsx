import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_DRAFTS } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

const path = "/refund-policy";

export const metadata: Metadata = pageMetadata({
  title: "Refund & Cancellation Policy",
  description: "Beyownd refund and cancellation policy for virtual internship program enrollments.",
  path,
  noindex: LEGAL_DRAFTS.has(path),
});

/* Placeholder until the owner's text arrives (REMAINING Y5). Never invent legal text here. */
export default function Page() {
  return <LegalPage path={path} title="Refund & Cancellation Policy" lead="When you can cancel and how refunds work." sections={[]} draft={{ covers: ["when a refund can be requested", "how to request one", "how long refunds take", "what happens to your documents after a refund", "batches that are cancelled or full"] }} />;
}
