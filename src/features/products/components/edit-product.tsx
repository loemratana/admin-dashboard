"use client";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";

import { useProduct } from "../hooks/use-products";
import { ProductForm } from "./product-form";
import { ProductNotFound } from "./product-not-found";

export function EditProduct({ productId }: { productId: string }) {
  const product = useProduct(productId);
  useBreadcrumbLabel(`/products/${productId}`, product?.name);

  if (!product) return <ProductNotFound />;

  return (
    <>
      <PageHeader title={`Edit ${product.name}`} description={product.sku} />
      {/* key: start from fresh values if the product changes underneath the form. */}
      <ProductForm key={product.id} product={product} />
    </>
  );
}
