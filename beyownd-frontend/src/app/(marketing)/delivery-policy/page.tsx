import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

const path = "/delivery-policy";

export const metadata: Metadata = pageMetadata({
  title: "Delivery Policy",
  description: "Beyownd programs are delivered online: classroom access on payment, documents as downloadable PDFs with a public verify link. Nothing is shipped.",
  path,
});

/*
 * Describes how the product is actually delivered (PAGES.md §3.10). Facts
 * only, matching what the platform does; legal terms live in /terms.
 */
const sections = [
  {
    id: "digital",
    title: "Everything is delivered online",
    body: <p>Beyownd programs are virtual internship programs. There is nothing to ship: the classroom, lessons, quizzes, project review and documents are all delivered through classroom.beyownd.in.</p>,
  },
  {
    id: "access",
    title: "When you get access",
    body: (
      <ul>
        <li>Your enrollment activates as soon as the payment is confirmed. Usually that is immediate; occasionally confirmation takes a few minutes.</li>
        <li>Free preview lessons are available right away. The rest of the program opens on your batch start date, shown on the program page and in your dashboard.</li>      </ul>
    ),
  },
  {
    id: "documents",
    title: "Documents",
    body: (
      <ul>
        <li><b className="font-medium text-ink">Offer letter:</b> generated when your enrollment activates, as a PDF in your Documents page.</li>
        <li><b className="font-medium text-ink">Completion certificate and completion letter:</b> issued after the batch ends, once you have completed every module and your final project is approved.</li>
        <li>Every document has a unique ID and QR code that anyone can check at <Link href="/verify">beyownd.in/verify</Link>.</li>
      </ul>
    ),
  },
  {
    id: "help",
    title: "If something doesn't arrive",
    body: (
      <p>
        If your enrollment hasn&apos;t activated after payment, or a document stays in &quot;being prepared&quot;, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your registered email and payment ID. Please don&apos;t pay a second time.
      </p>
    ),
  },
];

export default function DeliveryPolicyPage() {
  return <LegalPage path={path} title="Delivery Policy" lead="How and when you receive what you pay for." sections={sections} />;
}
