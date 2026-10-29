"use client";

import { useMemo } from "react";

import { useCan } from "@/features/access-control/hooks/use-access";
import { useProducts } from "@/features/products/hooks/use-products";
import type { Product } from "@/features/products/types/product";

import {
  createBrand,
  createCategory,
  createUnit,
  deleteBrand,
  deleteCategory,
  deleteUnit,
  renameBrand,
  renameCategory,
  updateUnit,
} from "../api/catalog-api";
import { useBrands, useCategories, useUnits } from "../hooks/use-catalog";
import { LookupManager } from "./lookup-manager";

// Counts every product, archived included: deleting a lookup an archived product
// still points at would break that product if it is restored.
function useUsage(key: "categoryId" | "brandId" | "unitId") {
  const products = useProducts();
  return useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product: Product) => {
      const id = product[key];
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return (id: string) => counts.get(id) ?? 0;
  }, [products, key]);
}

const nameField = (placeholder: string) => [{ key: "name", label: "Name", placeholder }];

export function CategoriesManager() {
  const categories = useCategories();
  const usage = useUsage("categoryId");
  const canManage = useCan("catalog.category.manage");
  return (
    <LookupManager
      title="Categories"
      noun="category"
      canManage={canManage}
      items={categories}
      fields={nameField("e.g. Kitchen Supplies")}
      usageCount={usage}
      onCreate={({ name }) => void createCategory(name)}
      onUpdate={(id, { name }) => void renameCategory(id, name)}
      onDelete={(id) => void deleteCategory(id)}
    />
  );
}

export function BrandsManager() {
  const brands = useBrands();
  const usage = useUsage("brandId");
  const canManage = useCan("catalog.brand.manage");
  return (
    <LookupManager
      title="Brands"
      noun="brand"
      canManage={canManage}
      items={brands}
      fields={nameField("e.g. Logitech")}
      usageCount={usage}
      onCreate={({ name }) => void createBrand(name)}
      onUpdate={(id, { name }) => void renameBrand(id, name)}
      onDelete={(id) => void deleteBrand(id)}
    />
  );
}

export function UnitsManager() {
  const units = useUnits();
  const usage = useUsage("unitId");
  const canManage = useCan("catalog.unit.manage");
  return (
    <LookupManager
      title="Units"
      noun="unit"
      canManage={canManage}
      items={units}
      fields={[
        { key: "name", label: "Name", placeholder: "e.g. Carton" },
        { key: "abbreviation", label: "Abbreviation", placeholder: "e.g. ctn", className: "w-28" },
      ]}
      usageCount={usage}
      onCreate={({ name, abbreviation }) => void createUnit(name, abbreviation)}
      onUpdate={(id, { name, abbreviation }) => void updateUnit(id, name, abbreviation)}
      onDelete={(id) => void deleteUnit(id)}
    />
  );
}
