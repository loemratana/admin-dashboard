"use client";

import { useMemo } from "react";

import { useAttributesByProduct, useVariants } from "@/features/product-variants/hooks/use-variants";
import type { ProductVariant } from "@/features/product-variants/types/variant";
import { effectivePrices } from "@/features/product-variants/utils/variant-utils";
import { useStockLevels } from "@/features/stock/hooks/use-stock";
import { onHand, variantLevel, type StockLevels } from "@/features/stock/utils/stock-math";
import { useStore } from "@/lib/create-store";

import { productsStore } from "../api/products-api";
import type { Product, ProductWithStock } from "../types/product";

// Reads go through these hooks so swapping the in-memory stores for a real
// backend only changes this file. Stock figures are calculated from the stock
// ledger, per variant, across all warehouses.
export function useProducts(): ProductWithStock[] {
  const products = useStore(productsStore);
  const variants = useVariants();
  const attributesByProduct = useAttributesByProduct();
  const levels = useStockLevels();

  return useMemo(() => {
    const byProduct = new Map<string, ProductVariant[]>();
    for (const variant of variants) {
      const list = byProduct.get(variant.productId) ?? [];
      list.push(variant);
      byProduct.set(variant.productId, list);
    }
    return products.map((product) =>
      withStock(product, byProduct.get(product.id) ?? [], !!attributesByProduct[product.id]?.length, levels),
    );
  }, [products, variants, attributesByProduct, levels]);
}

function withStock(product: Product, variants: ProductVariant[], hasVariants: boolean, levels: StockLevels): ProductWithStock {
  const active = variants.filter((variant) => variant.status === "active");
  const prices = (active.length > 0 ? active : variants).map((variant) => effectivePrices(variant, product).sellingPrice);
  return {
    ...product,
    // Inactive variants still physically hold their stock, so it counts.
    quantity: variants.reduce((sum, variant) => sum + onHand(variantLevel(levels, variant.id)), 0),
    available: variants.reduce((sum, variant) => sum + variantLevel(levels, variant.id).available, 0),
    stockValue: variants.reduce(
      (sum, variant) => sum + onHand(variantLevel(levels, variant.id)) * effectivePrices(variant, product).costPrice,
      0,
    ),
    hasVariants,
    variantCount: hasVariants ? variants.length : 0,
    priceRange: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: product.sellingPrice, max: product.sellingPrice },
    searchKeys: variants.flatMap((variant) => [variant.sku, variant.barcode]).join(" ").toLowerCase(),
  };
}

export function useProduct(id: string) {
  const products = useProducts();
  return useMemo(() => products.find((product) => product.id === id), [products, id]);
}

// Archived products drop out of stock figures, alerts and the default list.
export function useActiveProducts() {
  const products = useProducts();
  return useMemo(() => products.filter((product) => product.status !== "archived"), [products]);
}
