import { SiteNav } from "@/components/marketing/nav/site-nav";
import { Footer } from "@/components/marketing/footer";

/* Shared shell for every beyownd.in page: skip link, nav, footer. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-ink focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-[14px] focus-visible:font-medium focus-visible:text-white"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
