import { StaffShell } from "@/components/app/shell";

export const metadata = { title: "Admin" };

export default function AdminLayout({ children }: LayoutProps<"/app/admin">) {
  return <StaffShell roles={["admin"]}>{children}</StaffShell>;
}
