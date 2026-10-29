import type { AdjustmentReason, StockBucket, StockLevel, StockMovement } from "../types/stock";

// Pure calculations over the ledger, shared by the hooks (UI) and the API (validation).

export const emptyLevel = (): StockLevel => ({ available: 0, reserved: 0, damaged: 0, quarantined: 0 });

export const onHand = (level: StockLevel) => level.available + level.reserved + level.damaged + level.quarantined;

// variantId -> warehouseId -> level
export type StockLevels = Map<string, Map<string, StockLevel>>;

export function computeLevels(movements: StockMovement[]): StockLevels {
  const levels: StockLevels = new Map();
  for (const movement of movements) {
    const byWarehouse = levels.get(movement.variantId) ?? new Map<string, StockLevel>();
    const level = byWarehouse.get(movement.warehouseId) ?? emptyLevel();
    level[movement.bucket] += movement.quantity;
    byWarehouse.set(movement.warehouseId, level);
    levels.set(movement.variantId, byWarehouse);
  }
  return levels;
}

export function levelAt(levels: StockLevels, variantId: string, warehouseId: string): StockLevel {
  return levels.get(variantId)?.get(warehouseId) ?? emptyLevel();
}

// Sum a variant's levels over the given warehouses (all of them when omitted).
export function variantLevel(levels: StockLevels, variantId: string, warehouseIds?: string[]): StockLevel {
  const total = emptyLevel();
  for (const [warehouseId, level] of levels.get(variantId) ?? []) {
    if (warehouseIds && !warehouseIds.includes(warehouseId)) continue;
    total.available += level.available;
    total.reserved += level.reserved;
    total.damaged += level.damaged;
    total.quarantined += level.quarantined;
  }
  return total;
}

// locationId -> variantId -> level, for bins in bin-tracked warehouses.
export type BinLevels = Map<string, Map<string, StockLevel>>;

export function computeBinLevels(movements: StockMovement[]): BinLevels {
  const bins: BinLevels = new Map();
  for (const movement of movements) {
    if (!movement.locationId) continue;
    const byVariant = bins.get(movement.locationId) ?? new Map<string, StockLevel>();
    const level = byVariant.get(movement.variantId) ?? emptyLevel();
    level[movement.bucket] += movement.quantity;
    byVariant.set(movement.variantId, level);
    bins.set(movement.locationId, byVariant);
  }
  return bins;
}

export const binLevel = (bins: BinLevels, locationId: string, variantId: string): StockLevel =>
  bins.get(locationId)?.get(variantId) ?? emptyLevel();

// Everything physically in a bin (all items, all buckets): what counts against capacity.
export function binUnits(bins: BinLevels, locationId: string) {
  let total = 0;
  for (const level of bins.get(locationId)?.values() ?? []) total += onHand(level);
  return total;
}

// What each adjustment reason does to the buckets.
export const adjustmentEffects: Record<AdjustmentReason, { label: string; changes: [StockBucket, 1 | -1][] }> = {
  damaged: { label: "Damaged (move to damaged)", changes: [["available", -1], ["damaged", 1]] },
  lost: { label: "Lost or missing", changes: [["available", -1]] },
  found: { label: "Found", changes: [["available", 1]] },
  "write-off-damaged": { label: "Write off damaged", changes: [["damaged", -1]] },
  "correction-increase": { label: "Correction (increase)", changes: [["available", 1]] },
  "correction-decrease": { label: "Correction (decrease)", changes: [["available", -1]] },
  quarantine: { label: "Quarantine (hold for inspection)", changes: [["available", -1], ["quarantined", 1]] },
  "release-quarantine": { label: "Release from quarantine", changes: [["quarantined", -1], ["available", 1]] },
  "write-off-quarantined": { label: "Write off quarantined", changes: [["quarantined", -1]] },
};

// The bucket an adjustment takes stock from, if any (it must hold enough).
export function adjustmentSource(reason: AdjustmentReason): StockBucket | null {
  return adjustmentEffects[reason].changes.find(([, sign]) => sign === -1)?.[0] ?? null;
}
