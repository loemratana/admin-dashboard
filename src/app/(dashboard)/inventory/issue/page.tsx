import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { StockEntryForm } from "@/features/stock/components/stock-entry-form";

export default function StockOutPage() {
  return (
    <RequirePermission permission="inventory.movement.issue">
      <PageHeader title="Stock out" description="Record stock leaving a warehouse." />
      <StockEntryForm mode="issue" />
    </RequirePermission>
  );
}
