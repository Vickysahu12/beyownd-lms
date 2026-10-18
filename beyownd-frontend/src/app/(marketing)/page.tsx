import { SiteNav } from "@/components/marketing/nav/site-nav";
import { Hero } from "@/components/marketing/hero/hero";

export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-white transition-transform duration-200 ease-out focus:translate-y-0"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        {/* Next sections land here one at a time (brief §5.3 onwards). */}
        <div id="programs" className="h-[60vh] bg-cream" />
      </main>
    </>
  );
}
