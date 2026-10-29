import { RequirePermission } from "@/features/access-control/components/require-permission";
import { TransfersList } from "@/features/transfers/components/transfers-list";

export default function TransfersPage() {
  return (
    <RequirePermission permission="inventory.transfer.view">
      <TransfersList />
    </RequirePermission>
  );
}
