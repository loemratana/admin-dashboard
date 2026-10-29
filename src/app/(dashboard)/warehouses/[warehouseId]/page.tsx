import { RequirePermission } from "@/features/access-control/components/require-permission";
import { WarehouseDetails } from "@/features/warehouses/components/warehouse-details";

export default async function WarehousePage({ params }: PageProps<"/warehouses/[warehouseId]">) {
  const { warehouseId } = await params;
  return (
    <RequirePermission permission="inventory.warehouse.view">
      <WarehouseDetails warehouseId={warehouseId} />
    </RequirePermission>
  );
}
