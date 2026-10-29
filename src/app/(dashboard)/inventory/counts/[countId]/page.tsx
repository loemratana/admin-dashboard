import { RequirePermission } from "@/features/access-control/components/require-permission";
import { CountDetails } from "@/features/stock-counts/components/count-details";

export default async function StockCountPage({ params }: PageProps<"/inventory/counts/[countId]">) {
  const { countId } = await params;
  return (
    <RequirePermission permission="inventory.count.perform">
      <CountDetails countId={countId} />
    </RequirePermission>
  );
}
