"use client";

import { useMemo } from "react";

import { useMovements } from "./use-stock";
import { useStockItems } from "./use-stock-items";
import type { StockLevel } from "../types/stock";
import { computeBinLevels, emptyLevel } from "../utils/stock-math";

export type WarehouseStock = StockLevel & { onHand: number; value: number };

// Units and value at cost per warehouse, from the ledger.
export function useStockByWarehouse() {
  const movements = useMovements();
  const items = useStockItems();
  return useMemo(() => {
    const cost = new Map(items.map((item) => [item.variant.id, item.unitCost]));
    const totals = new Map<string, WarehouseStock>();
    for (const movement of movements) {
      const total = totals.get(movement.warehouseId) ?? { ...emptyLevel(), onHand: 0, value: 0 };
      total[movement.bucket] += movement.quantity;
      total.onHand += movement.quantity;
      total.value += movement.quantity * (cost.get(movement.variantId) ?? 0);
      totals.set(movement.warehouseId, total);
    }
    return totals;
  }, [movements, items]);
}

// locationId -> variantId -> level.
export function useBinLevels() {
  const movements = useMovements();
  return useMemo(() => computeBinLevels(movements), [movements]);
}
