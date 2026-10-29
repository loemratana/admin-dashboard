import { rolesStore, usersStore } from "@/features/access-control/api/access-api";
import { productsStore } from "@/features/products/api/products-api";
import { appendMovements, movementsStore, newGroupId } from "@/features/stock/api/ledger-store";
import type { StockBucket, StockMovement } from "@/features/stock/types/stock";
import { computeLevels, onHand, variantLevel } from "@/features/stock/utils/stock-math";
import { warehousesStore } from "@/features/warehouses/api/warehouses-api";
import { can } from "@/lib/authorization";
import { emitEvent } from "@/lib/events";

import type { ProductVariant, VariantAttribute } from "../types/variant";
import { combinations, comboKey, effectivePrices, MAX_ATTRIBUTES, variantKey } from "../utils/variant-utils";
import { attributesStore, newVariantId, variantsStore } from "./variants-api";

// Kept apart from variants-api because it needs the product list, and
// products-api already imports variants-api.

export type VariantDraft = {
  id?: string; // existing variant
  values: string[]; // option values in attribute order; [] for a simple product
  sku: string;
  barcode: string;
  costPrice: number | null;
  sellingPrice: number | null;
  openingQuantity: number; // only used for new variants
  status: "active" | "inactive";
};

export type SaveVariantsInput = {
  attributes: VariantAttribute[];
  variants: VariantDraft[];
  // When a simple product with stock gets variants: the combination that receives that stock.
  moveDefaultStockTo?: string;
  // Where new variants' opening quantities are recorded (needed when any is above 0).
  openingWarehouseId?: string;
};

export class VariantError extends Error {}

const SKU_PATTERN = /^[A-Z0-9_-]+$/;

export async function saveProductVariants(actorId: string, productId: string, input: SaveVariantsInput): Promise<void> {
  const actor = usersStore.getState().find((user) => user.id === actorId);
  if (!actor || !can(actor, rolesStore.getState(), "products.variant.manage")) {
    throw new VariantError("You can't manage variants.");
  }
  const product = productsStore.getState().find((candidate) => candidate.id === productId);
  if (!product) throw new VariantError("Product not found.");

  // --- attributes
  const attributes = input.attributes.map((attribute) => ({
    name: attribute.name.trim(),
    values: attribute.values.map((value) => value.trim()),
  }));
  if (attributes.length > MAX_ATTRIBUTES) throw new VariantError(`Use at most ${MAX_ATTRIBUTES} attributes.`);
  const names = attributes.map((attribute) => attribute.name.toLowerCase());
  if (names.some((name) => !name)) throw new VariantError("Every attribute needs a name.");
  if (new Set(names).size !== names.length) throw new VariantError("Attribute names must be different.");
  for (const attribute of attributes) {
    if (attribute.values.length === 0 || attribute.values.some((value) => !value)) {
      throw new VariantError(`Give "${attribute.name}" at least one value.`);
    }
    if (new Set(attribute.values.map((value) => value.toLowerCase())).size !== attribute.values.length) {
      throw new VariantError(`"${attribute.name}" has the same value twice.`);
    }
  }

  // --- one draft per combination
  const expected = combinations(attributes).map(comboKey);
  const draftKeys = input.variants.map((draft) => comboKey(draft.values));
  if (draftKeys.length !== expected.length || expected.some((key) => !draftKeys.includes(key))) {
    throw new VariantError("The variants don't match the attribute combinations.");
  }

  // --- SKUs, barcodes, prices
  const otherVariants = variantsStore.getState().filter((variant) => variant.productId !== productId);
  const otherProductSkus = new Set(productsStore.getState().filter((p) => p.id !== productId).map((p) => p.sku));
  const seenSkus = new Set<string>();
  const seenBarcodes = new Set<string>();
  const drafts = input.variants.map((draft) => {
    const sku = draft.sku.trim().toUpperCase();
    const barcode = draft.barcode.trim();
    const label = comboKey(draft.values) || "the product";
    if (!SKU_PATTERN.test(sku)) throw new VariantError(`SKU for ${label}: use letters, numbers, - or _ only.`);
    if (seenSkus.has(sku) || otherProductSkus.has(sku) || otherVariants.some((variant) => variant.sku === sku)) {
      throw new VariantError(`SKU ${sku} is already used.`);
    }
    seenSkus.add(sku);
    if (barcode) {
      if (barcode.length > 32) throw new VariantError(`Barcode for ${label} is too long.`);
      if (seenBarcodes.has(barcode) || otherVariants.some((variant) => variant.barcode === barcode)) {
        throw new VariantError(`Barcode ${barcode} is already used.`);
      }
      seenBarcodes.add(barcode);
    }
    for (const price of [draft.costPrice, draft.sellingPrice]) {
      if (price !== null && !(price >= 0)) throw new VariantError(`Prices for ${label} can't be negative.`);
    }
    if (!draft.id && !(Number.isInteger(draft.openingQuantity) && draft.openingQuantity >= 0)) {
      throw new VariantError(`Opening quantity for ${label} must be a whole number.`);
    }
    return { ...draft, sku, barcode };
  });

  // --- opening stock for new variants needs an active warehouse
  const needsWarehouse = drafts.some((draft) => !draft.id && draft.openingQuantity > 0);
  const openingWarehouse = warehousesStore.getState().find((warehouse) => warehouse.id === input.openingWarehouseId);
  if (needsWarehouse && openingWarehouse?.status !== "active") {
    throw new VariantError("Choose an active warehouse for the opening stock.");
  }
  if (needsWarehouse && openingWarehouse?.trackBins) {
    throw new VariantError("Bin-tracked warehouses take stock through Stock in, where you choose the bin.");
  }

  // --- stock can't disappear (it lives in the ledger, per variant and warehouse)
  const levels = computeLevels(movementsStore.getState());
  const previousAttributes = attributesStore.getState()[productId] ?? [];
  const existing = variantsStore.getState().filter((variant) => variant.productId === productId);
  const keptIds = new Set(drafts.flatMap((draft) => (draft.id ? [draft.id] : [])));
  let defaultToMove: ProductVariant | undefined;
  for (const variant of existing.filter((candidate) => !keptIds.has(candidate.id))) {
    const stock = onHand(variantLevel(levels, variant.id));
    if (stock === 0) continue;
    const isDefault = Object.keys(variant.options).length === 0;
    if (isDefault && input.moveDefaultStockTo && expected.includes(input.moveDefaultStockTo)) {
      defaultToMove = variant;
      continue;
    }
    const label = isDefault ? "The product" : variantKey(variant, previousAttributes);
    throw new VariantError(
      `${label} still has ${stock} in stock. ${isDefault ? "Choose which variant receives it." : "Move or adjust its stock before removing it."}`,
    );
  }

  // --- write
  const next: ProductVariant[] = drafts.map((draft) => {
    const before = existing.find((variant) => variant.id === draft.id);
    return {
      id: before?.id ?? newVariantId(),
      productId,
      sku: draft.sku,
      barcode: draft.barcode,
      options: Object.fromEntries(attributes.map((attribute, i) => [attribute.name, draft.values[i]])),
      costPrice: draft.costPrice,
      sellingPrice: draft.sellingPrice,
      status: draft.status,
    };
  });

  // --- ledger: opening stock for new variants, and the old single item's stock moved across
  const at = new Date().toISOString();
  const lines: Omit<StockMovement, "id" | "groupId">[] = [];
  next.forEach((variant, i) => {
    const draft = drafts[i];
    if (!draft.id && draft.openingQuantity > 0 && openingWarehouse) {
      lines.push({ at, type: "opening", productId, variantId: variant.id, warehouseId: openingWarehouse.id, locationId: null, bucket: "available", quantity: draft.openingQuantity, unitCost: effectivePrices(variant, product).costPrice, reference: "Opening balance", reason: "New variant", actorId });
    }
  });
  const target = next.find((variant, i) => comboKey(drafts[i].values) === input.moveDefaultStockTo);
  if (defaultToMove && target) {
    // Move it exactly where it sits: per warehouse, bin and bucket.
    const holdings = new Map<string, { warehouseId: string; locationId: string | null; bucket: StockBucket; quantity: number }>();
    for (const movement of movementsStore.getState().filter((candidate) => candidate.variantId === defaultToMove!.id)) {
      const key = [movement.warehouseId, movement.locationId, movement.bucket].join("|");
      const holding = holdings.get(key) ?? { warehouseId: movement.warehouseId, locationId: movement.locationId, bucket: movement.bucket, quantity: 0 };
      holding.quantity += movement.quantity;
      holdings.set(key, holding);
    }
    for (const { warehouseId, locationId, bucket, quantity } of holdings.values()) {
      if (quantity === 0) continue;
      const common = { at, type: "variant-change" as const, productId, warehouseId, locationId, bucket, unitCost: null, reference: `Variants of ${product.sku}`, reason: "Moved to a variant", actorId };
      lines.push({ ...common, variantId: defaultToMove.id, quantity: -quantity });
      lines.push({ ...common, variantId: target.id, quantity });
    }
  }
  variantsStore.setState((list) => [...list.filter((variant) => variant.productId !== productId), ...next]);
  if (lines.length > 0) appendMovements(newGroupId(), lines);
  attributesStore.setState((map) => {
    const copy = { ...map };
    if (attributes.length > 0) copy[productId] = attributes;
    else delete copy[productId];
    return copy;
  });
  emitEvent("product.variantsChanged", {
    actorId,
    productId,
    summary:
      attributes.length > 0
        ? `Updated variants of ${product.name}: ${next.length} variants (${attributes.map((attribute) => attribute.name).join(" × ")})`
        : `Removed variants from ${product.name}`,
  });
}
