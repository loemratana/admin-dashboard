import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { StockEntryForm } from "@/features/stock/components/stock-entry-form";

export default function StockInPage() {
  return (
    <RequirePermission permission="inventory.movement.receive">
      <PageHeader title="Stock in" description="Record stock arriving in a warehouse." />
      <StockEntryForm mode="receive" />
    </RequirePermission>
  );
}
