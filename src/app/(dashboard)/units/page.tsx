import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { UnitsManager } from "@/features/catalog/components/catalog-managers";

export default function UnitsPage() {
  return (
    <RequirePermission permission="catalog.unit.view">
      <PageHeader title="Units of measure" description="How each product is counted: pieces, boxes, rolls..." />
      <div className="max-w-3xl">
        <UnitsManager />
      </div>
    </RequirePermission>
  );
}
