import { RequirePermission } from "@/features/access-control/components/require-permission";
import { ProductDetails } from "@/features/products/components/product-details";

export default async function ProductPage({ params }: PageProps<"/products/[productId]">) {
  const { productId } = await params;
  return (
    <RequirePermission permission="products.product.view">
      <ProductDetails productId={productId} />
    </RequirePermission>
  );
}
