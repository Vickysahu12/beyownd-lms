import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/* Inner-page header: visible breadcrumb, the page's single <h1>, one lead paragraph. */
export function PageHeader({
  crumbs,
  title,
  lead,
  align = "left",
  children,
  className,
}: {
  crumbs: { name: string; href: string }[];
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mx-auto max-w-[1200px] px-4 pb-12 pt-[112px] sm:px-6 lg:px-8 lg:pb-16 lg:pt-[148px]", align === "center" && "text-center", className)}>
      <nav aria-label="Breadcrumb" className="rise">
        <ol className={cn("flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted", align === "center" && "justify-center")}>
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1.5">
              {i > 0 ? <HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={1.8} aria-hidden /> : null}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="text-ink-soft">{c.name}</span>
              ) : (
                <Link href={c.href} className="link-grow hover:text-ink">{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="rise display mt-5 text-balance text-[42px] leading-[1.05] text-ink sm:text-[60px] lg:text-[72px]" style={{ "--d": "60ms" } as React.CSSProperties}>
        {title}
      </h1>
      {lead ? (
        <p className={cn("rise mt-5 max-w-[40rem] text-[17px] leading-[1.6] text-ink-soft sm:text-[19px]", align === "center" && "mx-auto")} style={{ "--d": "120ms" } as React.CSSProperties}>
          {lead}
        </p>
      ) : null}
      {children ? <div className="rise mt-8" style={{ "--d": "180ms" } as React.CSSProperties}>{children}</div> : null}
    </header>
  );
}
