"use client";

import { useMemo } from "react";

import { useCatalogLookups } from "@/features/catalog/hooks/use-catalog";
import { useAttributesByProduct, useVariants } from "@/features/product-variants/hooks/use-variants";
import type { ProductVariant } from "@/features/product-variants/types/variant";
import { effectivePrices, variantLabel } from "@/features/product-variants/utils/variant-utils";
import { useProducts } from "@/features/products/hooks/use-products";
import type { ProductWithStock } from "@/features/products/types/product";

export type StockItem = {
  variant: ProductVariant;
  product: ProductWithStock;
  // "Ergonomic Chair — Black", or just the product name for simple products
  label: string;
  unit: string;
  unitCost: number;
  // Can receive/issue: variant active and product not archived.
  usable: boolean;
};

// Every variant with the product details the stock screens show.
export function useStockItems(): StockItem[] {
  const products = useProducts();
  const variants = useVariants();
  const attributesByProduct = useAttributesByProduct();
  const lookups = useCatalogLookups();

  return useMemo(() => {
    const productById = new Map(products.map((product) => [product.id, product]));
    return variants.flatMap((variant) => {
      const product = productById.get(variant.productId);
      if (!product) return [];
      const attributes = attributesByProduct[product.id] ?? [];
      return [
        {
          variant,
          product,
          label: attributes.length > 0 ? `${product.name} — ${variantLabel(variant, attributes)}` : product.name,
          unit: lookups.unit.get(product.unitId)?.abbreviation ?? "",
          unitCost: effectivePrices(variant, product).costPrice,
          usable: variant.status === "active" && product.status !== "archived",
        },
      ];
    });
  }, [products, variants, attributesByProduct, lookups]);
}
