import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { ProductForm } from "@/features/products/components/product-form";

export default function NewProductPage() {
  return (
    <RequirePermission permission="products.product.create">
      <PageHeader title="Add product" description="Fields marked * are required." />
      <ProductForm />
    </RequirePermission>
  );
}
