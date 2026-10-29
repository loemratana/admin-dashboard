"use client";

import { useMemo } from "react";

import { useActiveProducts } from "@/features/products/hooks/use-products";
import { getStockStatus } from "@/features/products/utils/stock-status";

import type { InventoryKpis } from "../types/dashboard";

// Derived from the live product store (archived products excluded), so the
// dashboard updates as soon as a product is created, edited or archived.
export function useInventorySummary() {
  const products = useActiveProducts();

  return useMemo(() => {
    const outOfStock = products.filter((product) => getStockStatus(product) === "out-of-stock");
    const lowStock = products
      .filter((product) => getStockStatus(product) === "low-stock")
      // Closest to running out first.
      .sort((a, b) => a.quantity / a.reorderLevel - b.quantity / b.reorderLevel);

    const kpis: InventoryKpis = {
      stockValue: products.reduce((sum, product) => sum + product.stockValue, 0),
      productCount: products.length,
      categoryCount: new Set(products.map((product) => product.categoryId)).size,
      unitsInStock: products.reduce((sum, product) => sum + product.quantity, 0),
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    };

    return { kpis, outOfStock, alerts: [...outOfStock, ...lowStock] };
  }, [products]);
}
