import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { MovementsLedger } from "@/features/stock/components/movements-ledger";

export default async function MovementsPage({ searchParams }: PageProps<"/inventory/movements">) {
  const { q } = await searchParams;
  return (
    <RequirePermission permission="inventory.stock.view">
      <PageHeader title="Stock movements" description="Every change to stock, newest first. Entries are never edited or deleted." />
      <MovementsLedger initialQuery={typeof q === "string" ? q : ""} />
    </RequirePermission>
  );
}
