import { RequirePermission } from "@/features/access-control/components/require-permission";
import { AdjustmentsManager } from "@/features/stock/components/adjustments-manager";

export default function AdjustmentsPage() {
  return (
    <RequirePermission permission="inventory.stock.view">
      <AdjustmentsManager />
    </RequirePermission>
  );
}
