import { RequirePermission } from "@/features/access-control/components/require-permission";
import { CountsList } from "@/features/stock-counts/components/counts-list";

export default function StockCountsPage() {
  return (
    <RequirePermission permission="inventory.count.perform">
      <CountsList />
    </RequirePermission>
  );
}
