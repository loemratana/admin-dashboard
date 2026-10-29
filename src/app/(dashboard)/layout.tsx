import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <DashboardShell>{children}</DashboardShell>;
}
