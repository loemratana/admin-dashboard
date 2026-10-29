import { RequirePermission } from "@/features/access-control/components/require-permission";
import { EditTransfer } from "@/features/transfers/components/edit-transfer";

export default async function EditTransferPage({ params }: PageProps<"/inventory/transfers/[transferId]/edit">) {
  const { transferId } = await params;
  return (
    <RequirePermission permission="inventory.transfer.create">
      <EditTransfer transferId={transferId} />
    </RequirePermission>
  );
}
