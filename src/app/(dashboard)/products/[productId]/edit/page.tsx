import { RequirePermission } from "@/features/access-control/components/require-permission";
import { EditProduct } from "@/features/products/components/edit-product";

export default async function EditProductPage({ params }: PageProps<"/products/[productId]/edit">) {
  const { productId } = await params;
  return (
    <RequirePermission permission="products.product.update">
      <EditProduct productId={productId} />
    </RequirePermission>
  );
}
