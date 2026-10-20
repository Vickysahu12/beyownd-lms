import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

/* Shared layout for 404 / error / empty-result pages: icon tile, light headline, actions. */
export function StatusPage({
  icon,
  tint = "bg-brand-wash text-brand",
  code,
  title,
  body,
  children,
}: {
  icon: IconSvgElement;
  tint?: string;
  code?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-[720px] flex-col items-center justify-center px-4 pb-20 pt-[132px] text-center">
      <span className={cn("rise grid size-16 place-items-center rounded-2xl", tint)}>
        <HugeiconsIcon icon={icon} size={30} strokeWidth={1.5} aria-hidden />
      </span>
      {code ? <p className="rise mt-6 font-mono text-[13px] text-muted" style={{ "--d": "60ms" } as React.CSSProperties}>{code}</p> : null}
      <h1 className="rise display mt-3 text-[40px] leading-[1.08] text-ink sm:text-[56px]" style={{ "--d": "100ms" } as React.CSSProperties}>
        {title}
      </h1>
      <div className="rise mt-4 max-w-[30rem] text-[17px] leading-[1.6] text-ink-soft" style={{ "--d": "160ms" } as React.CSSProperties}>
        {body}
      </div>
      {children ? <div className="rise mt-8 flex flex-wrap justify-center gap-3" style={{ "--d": "220ms" } as React.CSSProperties}>{children}</div> : null}
    </section>
  );
}
