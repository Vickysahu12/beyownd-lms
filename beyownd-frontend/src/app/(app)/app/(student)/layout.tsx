import { StudentShell } from "@/components/app/shell";

/* Student area: login + finished onboarding required (PAGES.md §4). */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
