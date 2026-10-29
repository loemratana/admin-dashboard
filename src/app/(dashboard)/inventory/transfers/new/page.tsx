import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { TransferForm } from "@/features/transfers/components/transfer-form";

export default function NewTransferPage() {
  return (
    <RequirePermission permission="inventory.transfer.create">
      <PageHeader title="New transfer" description="Request a move of stock. Someone other than you approves it before it's dispatched." />
      <TransferForm />
    </RequirePermission>
  );
}
