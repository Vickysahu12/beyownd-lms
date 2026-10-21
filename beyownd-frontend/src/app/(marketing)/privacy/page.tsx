import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_DRAFTS } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

const path = "/privacy";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Beyownd collects, uses and protects student data, including what the public certificate verification page shows.",
  path,
  noindex: LEGAL_DRAFTS.has(path),
});

/* Placeholder until the owner's text arrives (REMAINING Y5). Never invent legal text here. */
export default function Page() {
  return <LegalPage path={path} title="Privacy Policy" lead="What we collect, why, and how we protect it." sections={[]} draft={{ covers: ["the data we collect (account, profile, learning progress, payments)", "why we collect it", "what appears on the public verify page", "who we share it with (payment and email providers)", "how long we keep it", "your rights and how to delete your account"] }} />;
}
