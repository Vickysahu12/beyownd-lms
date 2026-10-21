import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_DRAFTS } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

const path = "/terms";

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description: "Beyownd Terms and Conditions for students using the classroom and joining virtual internship programs.",
  path,
  noindex: LEGAL_DRAFTS.has(path),
});

/* Placeholder until the owner's text arrives (REMAINING Y5). Never invent legal text here. */
export default function Page() {
  return <LegalPage path={path} title="Terms & Conditions" lead="The terms for using Beyownd and joining a program." sections={[]} draft={{ covers: ["who can enroll", "what a program includes", "your account and conduct", "how documents are issued and revoked", "liability", "governing law"] }} />;
}
