"use client";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { ProductNotFound } from "@/features/products/components/product-not-found";
import { useProduct } from "@/features/products/hooks/use-products";

import { VariantEditor } from "./variant-editor";

export function ManageVariants({ productId }: { productId: string }) {
  const product = useProduct(productId);
  useBreadcrumbLabel(`/products/${productId}`, product?.name);

  if (!product) return <ProductNotFound />;

  return (
    <>
      <PageHeader title={`Variants: ${product.name}`} description={`Parent SKU ${product.sku}`} />
      <VariantEditor key={product.id} product={product} />
    </>
  );
}
