import { RequirePermission } from "@/features/access-control/components/require-permission";
import { ManageVariants } from "@/features/product-variants/components/manage-variants";

export default async function ProductVariantsPage({ params }: PageProps<"/products/[productId]/variants">) {
  const { productId } = await params;
  return (
    <RequirePermission permission="products.variant.manage">
      <ManageVariants productId={productId} />
    </RequirePermission>
  );
}
