"use client";

import { useMemo } from "react";

import { useStore } from "@/lib/create-store";

import { brandsStore, categoriesStore, unitsStore } from "../api/catalog-api";

export const useCategories = () => useStore(categoriesStore);
export const useBrands = () => useStore(brandsStore);
export const useUnits = () => useStore(unitsStore);

// id -> record lookups for rendering names in tables and details.
export function useCatalogLookups() {
  const categories = useCategories();
  const brands = useBrands();
  const units = useUnits();

  return useMemo(
    () => ({
      category: new Map(categories.map((item) => [item.id, item])),
      brand: new Map(brands.map((item) => [item.id, item])),
      unit: new Map(units.map((item) => [item.id, item])),
    }),
    [categories, brands, units],
  );
}
