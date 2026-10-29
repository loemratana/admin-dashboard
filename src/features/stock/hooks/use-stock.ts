"use client";

import { useMemo } from "react";

import { useStore } from "@/lib/create-store";

import { adjustmentsStore, movementsStore } from "../api/ledger-store";
import { computeLevels } from "../utils/stock-math";

export const useMovements = () => useStore(movementsStore);
export const useAdjustments = () => useStore(adjustmentsStore);

// variantId -> warehouseId -> { available, reserved, damaged }, from the ledger.
export function useStockLevels() {
  const movements = useMovements();
  return useMemo(() => computeLevels(movements), [movements]);
}
