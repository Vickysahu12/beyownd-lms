import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, QrCode01Icon, SecurityCheckIcon, UserCheck01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { links } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Section } from "./section";
import { VerifyDemo } from "./verify-demo";

/* 5.7 Verify: the differentiator. Giant statement headline + a live demo with floating context cards. */
export function Verify() {
  return (
    <Section id="verify" labelledBy="verify-title">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-14">
        <h2 id="verify-title" className="reveal display text-[56px] leading-[0.98] text-ink sm:text-[88px] lg:text-[112px]">
          Checked in <span className="text-brand">seconds</span>
        </h2>
        <div className="reveal lg:pt-6" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="text-[19px] leading-[1.55] text-ink sm:text-[21px]">
            <span className="font-medium">A certificate is only as good as its proof.</span> Every Beyownd document has a unique ID and
            QR code. Colleges and recruiters check it themselves, with no login and no emails.
          </p>
          <Link href={links.verify} className={cn(buttonVariants({ variant: "dark", size: "lg" }), "mt-8")}>
            <span>Verify a certificate</span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} aria-hidden className="-mr-1 transition-transform duration-200 ease-out group-hover/btn:translate-x-[3px]" />
          </Link>
        </div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[1200px] lg:mt-20">
        <Floating className="left-0 top-6 hidden lg:block" title="Unique ID" icon={QrCode01Icon} tint="bg-sky-3 text-brand-navy" delay="0s">
          <p className="font-mono text-[12.5px] text-ink">BYD-26-7KQ4-M9XA</p>
        </Floating>
        <Floating className="right-0 top-0 hidden lg:block" title="No login needed" icon={UserCheck01Icon} tint="bg-lavender text-[#5b3aa8]" delay="-2s">
          <p className="text-[13px] text-muted">Your TPO can check it from any phone.</p>
        </Floating>
        <Floating className="bottom-4 right-6 hidden lg:block" title="Revocable" icon={SecurityCheckIcon} tint="bg-peach text-[#8a3b12]" delay="-4s">
          <p className="text-[13px] text-muted">If a certificate is revoked, the page says so.</p>
        </Floating>

        <div className="reveal mx-auto max-w-[600px] rounded-[32px] bg-canvas p-3 sm:p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <VerifyDemo />
        </div>
      </div>
    </Section>
  );
}

function Floating({
  className,
  title,
  icon,
  tint,
  delay,
  children,
}: {
  className: string;
  title: string;
  icon: typeof QrCode01Icon;
  tint: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("absolute z-10 w-[230px] xl:w-[250px]", className)}>
      <div className="float lift rounded-2xl bg-white p-4 shadow-[var(--shadow-board)] ring-1 ring-line" style={{ animationDelay: delay }}>
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-8 place-items-center rounded-lg", tint)}>
            <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-[14.5px] text-ink">{title}</p>
        </div>
        <div className="mt-2.5">{children}</div>
      </div>
    </div>
  );
}
