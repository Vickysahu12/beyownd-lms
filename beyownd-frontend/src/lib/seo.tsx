import type { Metadata } from "next";
import { SITE_URL } from "./site";

/*
 * One helper so every indexable marketing page gets the same complete block:
 * unique title + description, canonical, Open Graph (en_IN), Twitter card.
 * Images come from opengraph-image files (root default, per-program override).
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "Beyownd", locale: "en_IN", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * Serialise JSON-LD for an inline <script>. Every "<" becomes the six
 * characters \u003c (a real backslash, still valid JSON), so a value such as
 * "</script>" can never close the tag early (XSS). U+2028 / U+2029 are
 * escaped too, since some parsers treat them as line breaks.
 * The replacement string must be "\\u003c": "\u003c" is just "<" again.
 */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** JSON-LD script. Content always goes through serializeJsonLd. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export const absolute = (path: string) => new URL(path, SITE_URL).toString();

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absolute(it.path) })),
  };
}

export const organization = {
  "@type": "Organization",
  name: "Beyownd",
  url: SITE_URL,
  logo: absolute("/icon.svg"),
  email: "hello@beyownd.in",
  // Legal name to be filled when GrewDo's registration is done (REMAINING Y1).
  parentOrganization: { "@type": "Organization", name: "GrewDo" },
};
