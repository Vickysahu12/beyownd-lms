import { StaffShell } from "@/components/app/shell";

export const metadata = { title: "Review queue" };

export default function ReviewLayout({ children }: LayoutProps<"/app/review">) {
  return <StaffShell roles={["mentor", "admin"]}>{children}</StaffShell>;
}
