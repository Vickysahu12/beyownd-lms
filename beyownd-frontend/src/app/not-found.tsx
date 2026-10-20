import type { Metadata } from "next";
import { Compass01Icon } from "@hugeicons/core-free-icons";
import { SiteNav } from "@/components/marketing/nav/site-nav";
import { Footer } from "@/components/marketing/footer";
import { StatusPage } from "@/components/marketing/status-page";
import { ButtonLink } from "@/components/ui/button";
import { links } from "@/lib/site";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <StatusPage
          icon={Compass01Icon}
          code="404"
          title={<>This page took a <span className="text-brand">detour</span></>}
          body="The link may be old or mistyped. Here are the places most people are looking for."
        >
          <ButtonLink href={links.programs} size="lg" arrow>See programs</ButtonLink>
          <ButtonLink href={links.verify} variant="outline" size="lg">Verify a certificate</ButtonLink>
        </StatusPage>
      </main>
      <Footer />
    </>
  );
}
