import { RequirePermission } from "@/features/access-control/components/require-permission";
import { WarehousesManager } from "@/features/warehouses/components/warehouses-manager";

export default function WarehousesPage() {
  return (
    <RequirePermission permission="inventory.warehouse.view">
      <WarehousesManager />
    </RequirePermission>
  );
}
