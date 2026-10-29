"use client";

import { useMemo } from "react";

import { useStore } from "@/lib/create-store";

import { attributesStore, variantsStore } from "../api/variants-api";

export const useVariants = () => useStore(variantsStore);
export const useAttributesByProduct = () => useStore(attributesStore);

export function useProductVariants(productId: string) {
  const variants = useVariants();
  const attributes = useAttributesByProduct()[productId];
  return useMemo(
    () => ({
      attributes: attributes ?? [],
      variants: variants.filter((variant) => variant.productId === productId),
    }),
    [variants, attributes, productId],
  );
}
