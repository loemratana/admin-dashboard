import { Plus } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { Can } from "@/features/access-control/components/can";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { ProductTable } from "@/features/products/components/product-table";

export default function ProductsPage() {
  return (
    <RequirePermission permission="products.product.view">
      <PageHeader
        title="Products"
        description="Manage your product catalog."
        actions={
          <Can permission="products.product.create">
            <LinkButton href="/products/new">
              <Plus data-icon="inline-start" />
              Add product
            </LinkButton>
          </Can>
        }
      />
      <ProductTable />
    </RequirePermission>
  );
}
