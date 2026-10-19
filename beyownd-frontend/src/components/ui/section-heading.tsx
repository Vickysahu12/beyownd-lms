import { cn } from "@/lib/utils";

/**
 * Section heading: Poppins 300, tight tracking, one emphasised word in brand blue.
 * size "xl" is for the big statement headlines (monday's "Full control" scale).
 */
export function SectionHeading({
  id,
  title,
  sub,
  align = "left",
  size = "lg",
  className,
}: {
  id: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "center";
  size?: "lg" | "xl";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", size === "xl" ? "max-w-[56rem]" : "max-w-[46rem]", className)}>
      <h2
        id={id}
        className={cn(
          "reveal display text-balance text-ink",
          size === "xl" ? "text-[48px] leading-[1.02] sm:text-[72px] lg:text-[96px]" : "text-[36px] sm:text-[48px] lg:text-[60px]",
        )}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={cn("reveal mt-5 max-w-[38rem] text-[17px] leading-[1.6] text-muted text-pretty sm:text-[19px]", align === "center" && "mx-auto")}
          style={{ "--i": 1 } as React.CSSProperties}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
