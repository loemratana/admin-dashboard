import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { BrandsManager } from "@/features/catalog/components/catalog-managers";

export default function BrandsPage() {
  return (
    <RequirePermission permission="catalog.brand.view">
      <PageHeader title="Brands" description="Manufacturers or labels you stock." />
      <div className="max-w-3xl">
        <BrandsManager />
      </div>
    </RequirePermission>
  );
}
