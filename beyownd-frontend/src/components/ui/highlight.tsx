import { cn } from "@/lib/utils";

/** The one emphasised word in a section heading: brand colour, same weight. */
export function Highlight({ children, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return <span className={cn("text-brand", className)}>{children}</span>;
}
