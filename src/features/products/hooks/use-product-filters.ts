"use client";

import { useMemo, useState } from "react";

import type { ProductWithStock, StockStatus } from "../types/product";
import { getStockStatus } from "../utils/stock-status";

// "current" = everything except archived, the default view.
export type ProductStatusFilter = "current" | "active" | "inactive" | "archived";

export function useProductFilters(products: ProductWithStock[]) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stock, setStock] = useState<StockStatus | "all">("all");
  const [status, setStatus] = useState<ProductStatusFilter>("current");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter(
      (product) =>
        (!query ||
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          // Variant SKUs and barcodes, so scanning a barcode finds its product.
          product.searchKeys.includes(query)) &&
        (categoryId === "all" || product.categoryId === categoryId) &&
        (stock === "all" || getStockStatus(product) === stock) &&
        (status === "current" ? product.status !== "archived" : product.status === status),
    );
  }, [products, search, categoryId, stock, status]);

  const isFiltered = search !== "" || categoryId !== "all" || stock !== "all" || status !== "current";
  const filterKey = JSON.stringify([search, categoryId, stock, status]);

  const resetFilters = () => {
    setSearch("");
    setCategoryId("all");
    setStock("all");
    setStatus("current");
  };

  return {
    search,
    setSearch,
    categoryId,
    setCategoryId,
    stock,
    setStock,
    status,
    setStatus,
    filteredProducts,
    isFiltered,
    filterKey,
    resetFilters,
  };
}
