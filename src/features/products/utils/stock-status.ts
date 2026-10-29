import type { StatusTone } from "@/components/shared/status-badge";

import type { StockStatus } from "../types/product";

// Based on what can be sold: available stock when known (reserved and damaged units excluded).
export function getStockStatus(product: { quantity: number; available?: number; reorderLevel: number }): StockStatus {
  const sellable = product.available ?? product.quantity;
  if (sellable <= 0) return "out-of-stock";
  if (sellable <= product.reorderLevel) return "low-stock";
  return "in-stock";
}

export const stockStatusDisplay: Record<StockStatus, { label: string; tone: StatusTone }> = {
  "in-stock": { label: "In stock", tone: "success" },
  "low-stock": { label: "Low stock", tone: "warning" },
  "out-of-stock": { label: "Out of stock", tone: "danger" },
};
