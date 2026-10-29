import { productSeed, seedProductId, variantSeed } from "@/features/products/api/sample-data";
import { createStore } from "@/lib/create-store";

import type { AdjustmentRequest, StockMovement } from "../types/stock";

// The movement ledger and adjustment requests, held in memory until the backend
// exists. This file only stores and appends; rules live in stock-api.ts. It must
// not import the products, variants-editing or warehouses APIs (they import it).

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${String(++sequence).padStart(5, "0")}`;
export const newGroupId = () => nextId("grp");

type NewMovement = Omit<StockMovement, "id" | "groupId">;

export class StockError extends Error {}

const balanceKey = (movement: Pick<StockMovement, "variantId" | "warehouseId" | "locationId" | "bucket">) =>
  [movement.variantId, movement.warehouseId, movement.locationId ?? "", movement.bucket].join("|");

// The ledger's own invariant, like a database constraint: no posting may leave
// any bucket (item × warehouse × bin × bucket) below zero. Every rule in
// stock-api already checks this; this is the last line of defence. Checking and
// appending happen synchronously, so nothing can interleave in between. A real
// backend must do the same inside one transaction with row locks.
export function appendMovements(groupId: string, lines: NewMovement[]) {
  const entries = lines.map((line) => ({ ...line, id: nextId("mv"), groupId }));
  const touched = new Set(entries.map(balanceKey));
  const balances = new Map<string, number>();
  for (const movement of [...movementsStore.getState(), ...entries]) {
    const key = balanceKey(movement);
    if (touched.has(key)) balances.set(key, (balances.get(key) ?? 0) + movement.quantity);
  }
  for (const [key, balance] of balances) {
    if (balance < 0) {
      const [, , , bucket] = key.split("|");
      throw new StockError(`Not enough ${bucket} stock: this would go ${balance} below zero. Refresh and try again.`);
    }
  }
  movementsStore.setState((list) => [...list, ...entries]);
  return entries;
}

// ---- sample data -----------------------------------------------------------

const OPENED_AT = "2026-10-01T08:00:00Z";
const SYSTEM_ACTOR = "u-01";

function seedMovements(): StockMovement[] {
  const lines: NewMovement[] = [];
  const open = (productId: string, variantId: string, quantity: number, unitCost: number) => {
    // Split opening stock between the two active warehouses, roughly 70/30.
    const main = Math.ceil(quantity * 0.7);
    for (const [warehouseId, qty] of [["wh-main", main], ["wh-east", quantity - main]] as const) {
      if (qty > 0) {
        lines.push({ at: OPENED_AT, type: "opening", productId, variantId, warehouseId, locationId: null, bucket: "available", quantity: qty, unitCost, reference: "Opening balance", reason: "", actorId: SYSTEM_ACTOR });
      }
    }
  };
  productSeed.forEach(([sku, , , , , costPrice, , quantity], index) => {
    const productId = seedProductId(index);
    const definition = variantSeed[sku];
    if (!definition) return open(productId, `var-${productId}-0`, quantity, costPrice);
    definition.variants.forEach((variant, n) => open(productId, `var-${productId}-${n + 1}`, variant.quantity, variant.costPrice ?? costPrice));
  });

  const move = (at: string, type: StockMovement["type"], productId: string, variantId: string, warehouseId: string, changes: [StockMovement["bucket"], number][], reference: string, reason: string) =>
    changes.forEach(([bucket, quantity]) =>
      lines.push({ at, type, productId, variantId, warehouseId, locationId: null, bucket, quantity, unitCost: null, reference, reason, actorId: "u-03" }),
    );
  move("2026-10-20T10:00:00Z", "reservation", "prd-0001", "var-prd-0001-0", "wh-main", [["available", -10], ["reserved", 10]], "SO-2240", "Held for sales order");
  move("2026-10-21T09:30:00Z", "reservation", "prd-0007", "var-prd-0007-0", "wh-main", [["available", -50], ["reserved", 50]], "SO-2238", "Held for sales order");
  move("2026-10-22T14:00:00Z", "reservation", "prd-0016", "var-prd-0016-2", "wh-main", [["available", -20], ["reserved", 20]], "SO-2241", "Held for sales order");
  move("2026-10-23T11:15:00Z", "adjustment", "prd-0018", "var-prd-0018-0", "wh-main", [["available", -6], ["damaged", 6]], "ADJ-0001", "Damaged (move to damaged)");
  move("2026-10-24T16:40:00Z", "adjustment", "prd-0005", "var-prd-0005-0", "wh-east", [["available", -2], ["damaged", 2]], "ADJ-0002", "Damaged (move to damaged)");

  // One group per reference (openings each stand alone).
  const groups = new Map<string, string>();
  return lines.map((line) => {
    const key = line.type === "opening" ? `${line.variantId}-${line.warehouseId}` : line.reference;
    if (!groups.has(key)) groups.set(key, newGroupId());
    return { ...line, id: nextId("mv"), groupId: groups.get(key)! };
  });
}

export const movementsStore = createStore<StockMovement[]>(seedMovements());

// Each sample adjustment's system quantity: available stock when it was requested
// (approved ones already took their quantity out, so add it back).
const withSystemQuantities = (requests: AdjustmentRequest[]) => {
  const available = (request: AdjustmentRequest) =>
    movementsStore
      .getState()
      .filter((movement) => movement.variantId === request.variantId && movement.warehouseId === request.warehouseId && movement.bucket === "available")
      .reduce((sum, movement) => sum + movement.quantity, 0);
  return requests.map((request) => ({ ...request, systemQuantity: available(request) + (request.status === "approved" ? request.quantity : 0) }));
};

export const adjustmentsStore = createStore<AdjustmentRequest[]>(withSystemQuantities([
  { id: "adj-1", number: "ADJ-0001", warehouseId: "wh-main", locationId: null, productId: "prd-0018", variantId: "var-prd-0018-0", reason: "damaged", quantity: 6, systemQuantity: 0, countedQuantity: null, variance: -6, note: "Crushed in a dropped carton", documents: [], status: "approved", requestedBy: "u-04", requestedAt: "2026-10-23T09:05:00Z", decidedBy: "u-03", decidedAt: "2026-10-23T11:15:00Z", decisionNote: "" },
  { id: "adj-2", number: "ADJ-0002", warehouseId: "wh-east", locationId: null, productId: "prd-0005", variantId: "var-prd-0005-0", reason: "damaged", quantity: 2, systemQuantity: 0, countedQuantity: null, variance: -2, note: "Cracked lenses on arrival", documents: [], status: "approved", requestedBy: "u-10", requestedAt: "2026-10-24T15:20:00Z", decidedBy: "u-03", decidedAt: "2026-10-24T16:40:00Z", decisionNote: "" },
  { id: "adj-3", number: "ADJ-0003", warehouseId: "wh-main", locationId: null, productId: "prd-0008", variantId: "var-prd-0008-0", reason: "lost", quantity: 3, systemQuantity: 0, countedQuantity: null, variance: -3, note: "Packs missing after cycle count", documents: [], status: "pending", requestedBy: "u-04", requestedAt: "2026-10-26T08:45:00Z", decidedBy: null, decidedAt: null, decisionNote: "" },
]));
