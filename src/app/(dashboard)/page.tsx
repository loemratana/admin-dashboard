import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { getDashboardData } from "@/features/dashboard/api/dashboard-api";
import { KpiCards } from "@/features/dashboard/components/kpi-cards";
import { PendingTasks } from "@/features/dashboard/components/pending-tasks";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { StockAlerts } from "@/features/dashboard/components/stock-alerts";
import { StockMovementChart } from "@/features/dashboard/components/stock-movement-chart";

export default async function DashboardPage() {
  const { movements, transactions, tasks } = await getDashboardData();

  return (
    <RequirePermission permission="dashboard.overview.view">
      <div className="flex flex-col gap-4">
        <PageHeader title="Dashboard" description="Overview of your inventory." />

        <KpiCards />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <StockMovementChart data={movements} />
          </div>
          <StockAlerts />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <RecentTransactions transactions={transactions} />
          </div>
          <div className="flex flex-col gap-4">
            <QuickActions />
            <PendingTasks tasks={tasks} />
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
