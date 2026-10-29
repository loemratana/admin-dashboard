import { createDefaultVariant, syncDefaultVariantSku, variantSkuOwner } from "@/features/product-variants/api/variants-api";
import { appendMovements, newGroupId } from "@/features/stock/api/ledger-store";
import { warehousesStore } from "@/features/warehouses/api/warehouses-api";
import { createStore } from "@/lib/create-store";

import type { ProductInput } from "../schemas/product-schema";
import type { Product } from "../types/product";
import { productSeed, seedProductId } from "./sample-data";

// Sample data held in memory until the backend exists. Replace the functions
// below with real requests, mapping the backend's response shape to Product
// here (Adapter step); components only go through this module and the hooks.
// Stock isn't stored on the product: each product's variants hold it.
const SEEDED_AT = "2026-09-01T09:00:00Z";

export const productsStore = createStore<Product[]>(
  productSeed.map(([sku, name, categoryId, brandId, unitId, costPrice, sellingPrice, , reorderLevel], index) => ({
    id: seedProductId(index),
    sku,
    name,
    description: "",
    categoryId,
    brandId,
    unitId,
    costPrice,
    sellingPrice,
    reorderLevel,
    status: "active",
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  })),
);

function nextProductId(products: Product[]) {
  const highest = Math.max(0, ...products.map((product) => Number(product.id.replace("prd-", "")) || 0));
  return `prd-${String(highest + 1).padStart(4, "0")}`;
}

export async function listProducts(): Promise<Product[]> {
  return productsStore.getState();
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return productsStore.getState().find((product) => product.id === id);
}

// SKUs are unique across products and every variant of other products.
export function isSkuTaken(sku: string, exceptId?: string) {
  const normalized = sku.trim().toUpperCase();
  const owner = variantSkuOwner(normalized);
  return (
    productsStore.getState().some((product) => product.sku === normalized && product.id !== exceptId) ||
    (owner !== undefined && owner !== exceptId)
  );
}

// The opening quantity is recorded in the stock ledger against the default variant.
export async function createProduct({ quantity, openingWarehouseId, ...input }: ProductInput, actorId: string): Promise<Product> {
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === openingWarehouseId);
  if (quantity > 0 && warehouse?.status !== "active") throw new Error("Choose an active warehouse for the opening stock.");
  if (quantity > 0 && warehouse?.trackBins) throw new Error("Bin-tracked warehouses take stock through Stock in, where you choose the bin.");
  const now = new Date().toISOString();
  let created!: Product;
  productsStore.setState((products) => {
    created = { ...input, id: nextProductId(products), createdAt: now, updatedAt: now };
    return [...products, created];
  });
  const variant = createDefaultVariant(created.id, created.sku);
  if (quantity > 0 && warehouse) {
    appendMovements(newGroupId(), [
      { at: now, type: "opening", productId: created.id, variantId: variant.id, warehouseId: warehouse.id, locationId: null, bucket: "available", quantity, unitCost: created.costPrice, reference: "Opening balance", reason: "New product", actorId },
    ]);
  }
  return created;
}

// Stock is not editable here: it changes through variants (and later stock transactions).
export async function updateProduct(id: string, input: Omit<ProductInput, "quantity">): Promise<void> {
  const now = new Date().toISOString();
  // The form sends its full values; drop the quantity so it can't overwrite stock.
  const changes: Partial<ProductInput> = { ...input };
  delete changes.quantity;
  delete changes.openingWarehouseId;
  productsStore.setState((products) =>
    products.map((product) => (product.id === id ? { ...product, ...changes, updatedAt: now } : product)),
  );
  syncDefaultVariantSku(id, input.sku);
}

export async function setProductArchived(id: string, archived: boolean): Promise<void> {
  const now = new Date().toISOString();
  productsStore.setState((products) =>
    products.map((product) =>
      product.id === id ? { ...product, status: archived ? "archived" : "active", updatedAt: now } : product,
    ),
  );
}
