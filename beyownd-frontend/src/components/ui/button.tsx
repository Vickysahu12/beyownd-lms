import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/*
 * Button system from the brief: black pill primary + translucent glass secondary.
 * Press: scale 0.97 over 140ms (feedback tier), released by the same transition
 * so it springs back from wherever it is. The arrow nudges only on real hover.
 */
export const buttonVariants = cva(
  [
    "group/btn relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium",
    "transition-[transform,background-color,box-shadow,color] duration-[140ms] ease-out",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand focus-visible:rounded-full",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: ["bg-brand text-white hover:bg-brand-hover hover:shadow-[0_8px_20px_-8px_rgb(49_87_232/0.6)]"],
        dark: ["bg-ink text-white hover:bg-black"],
        outline: ["bg-white text-ink ring-1 ring-inset ring-[#535768] hover:bg-canvas"],
        glass: ["bg-white text-ink ring-1 ring-inset ring-line-strong hover:bg-canvas"],
        ghost: ["text-ink hover:bg-ink/5"],
      },
      size: {
        sm: "h-10 px-4 text-[14px]",
        md: "h-11 px-5 text-[15px]",
        lg: "h-[54px] px-7 text-[16.5px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonLinkProps = VariantProps<typeof buttonVariants> & {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Leading icon (static). */
  icon?: IconSvgElement;
  /** Trailing arrow that nudges right on hover. */
  arrow?: boolean;
} & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;

export function ButtonLink({
  href,
  variant,
  size,
  className,
  icon,
  arrow,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {icon ? <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} aria-hidden /> : null}
      <span>{children}</span>
      {arrow ? <NudgeArrow /> : null}
    </Link>
  );
}

export function NudgeArrow({ className }: { className?: string }) {
  return (
    <HugeiconsIcon
      icon={ArrowRight02Icon}
      size={18}
      strokeWidth={1.8}
      aria-hidden
      className={cn(
        "-mr-1 transition-transform duration-200 ease-out",
        "group-hover/btn:translate-x-[3px]",
        className,
      )}
    />
  );
}
