import { RequirePermission } from "@/features/access-control/components/require-permission";
import { TransferDetails } from "@/features/transfers/components/transfer-details";

export default async function TransferPage({ params }: PageProps<"/inventory/transfers/[transferId]">) {
  const { transferId } = await params;
  return (
    <RequirePermission permission="inventory.transfer.view">
      <TransferDetails transferId={transferId} />
    </RequirePermission>
  );
}
