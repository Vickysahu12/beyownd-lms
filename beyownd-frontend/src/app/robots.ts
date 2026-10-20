import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/*
 * Marketing host: allow crawling. /verify/<id> pages stay crawlable on purpose
 * so Google can read their noindex (blocking them here would let bare URLs get
 * indexed without it); they are also left out of the sitemap.
 * The classroom host gets its own Disallow-all robots.txt via proxy.ts.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
