import { productSeed, seedProductId, variantSeed } from "@/features/products/api/sample-data";
import { createStore } from "@/lib/create-store";

import type { ProductVariant, VariantAttribute } from "../types/variant";
import { suggestVariantSku } from "../utils/variant-utils";

// Variants and attributes held in memory until the backend exists.

function seed() {
  const variants: ProductVariant[] = [];
  const attributes: Record<string, VariantAttribute[]> = {};
  productSeed.forEach(([sku], index) => {
    const productId = seedProductId(index);
    const definition = variantSeed[sku];
    if (!definition) {
      variants.push(defaultVariant(`var-${productId}-0`, productId, sku));
      return;
    }
    attributes[productId] = definition.attributes;
    definition.variants.forEach((entry, n) => {
      variants.push({
        id: `var-${productId}-${n + 1}`,
        productId,
        sku: suggestVariantSku(sku, entry.values),
        barcode: "",
        options: Object.fromEntries(definition.attributes.map((attribute, i) => [attribute.name, entry.values[i]])),
        costPrice: entry.costPrice ?? null,
        sellingPrice: entry.sellingPrice ?? null,
        status: "active",
      });
    });
  });
  return { variants, attributes };
}

function defaultVariant(id: string, productId: string, sku: string): ProductVariant {
  return { id, productId, sku, barcode: "", options: {}, costPrice: null, sellingPrice: null, status: "active" };
}

const seeded = seed();
export const variantsStore = createStore<ProductVariant[]>(seeded.variants);
// productId -> attributes; products without an entry are simple (one default variant).
export const attributesStore = createStore<Record<string, VariantAttribute[]>>(seeded.attributes);

export const newVariantId = () => `var-${Math.random().toString(36).slice(2, 10)}`;

// Called when a product is created: every product starts with one default variant.
export function createDefaultVariant(productId: string, sku: string): ProductVariant {
  const variant = defaultVariant(newVariantId(), productId, sku);
  variantsStore.setState((list) => [...list, variant]);
  return variant;
}

// A simple product's SKU lives on its default variant too; keep them in step.
export function syncDefaultVariantSku(productId: string, sku: string) {
  if (attributesStore.getState()[productId]?.length) return;
  variantsStore.setState((list) =>
    list.map((variant) => (variant.productId === productId && Object.keys(variant.options).length === 0 ? { ...variant, sku } : variant)),
  );
}

// SKUs held by variants of other products (a product's own default variant shares its SKU).
export function variantSkuOwner(sku: string): string | undefined {
  const normalized = sku.trim().toUpperCase();
  return variantsStore.getState().find((variant) => variant.sku === normalized)?.productId;
}
