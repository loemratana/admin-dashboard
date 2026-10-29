"use client";

import { useWarehouses, useLocationTree } from "@/features/warehouses/hooks/use-warehouses";
import { formatNumber } from "@/lib/format";

import { useBinLevels } from "../hooks/use-warehouse-stock";
import type { StockItem } from "../hooks/use-stock-items";
import type { StockBucket } from "../types/stock";
import { binLevel, binUnits } from "../utils/stock-math";

type BinSelectProps = {
  warehouseId: string;
  // "in" offers bins the item may go into; "out" offers bins that hold it.
  direction: "in" | "out";
  // For "out": the bucket being taken from (e.g. releasing quarantine takes from "quarantined").
  sourceBucket?: StockBucket;
  item: StockItem | undefined;
  value: string | null;
  onChange: (locationId: string | null) => void;
  label: string;
};

const selectClasses =
  "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

// Renders nothing for warehouses that don't track bins.
export function BinSelect({ warehouseId, direction, sourceBucket = "available", item, value, onChange, label }: BinSelectProps) {
  const warehouse = useWarehouses().find((candidate) => candidate.id === warehouseId);
  const tree = useLocationTree(warehouseId);
  const bins = useBinLevels();
  if (!warehouse?.trackBins) return null;

  const options = tree
    .filter((node) => node.location.type === "bin")
    .flatMap((node) => {
      const { location } = node;
      if (direction === "in") {
        if (!node.active) return [];
        if (item && location.allowedCategoryIds.length > 0 && !location.allowedCategoryIds.includes(item.product.categoryId)) return [];
        const free = location.capacity === null ? null : location.capacity - binUnits(bins, location.id);
        return [{ id: location.id, label: `${node.code}${free === null ? "" : ` · ${formatNumber(Math.max(free, 0))} free`}`, disabled: free !== null && free <= 0 }];
      }
      const held = item ? binLevel(bins, location.id, item.variant.id)[sourceBucket] : 0;
      return held > 0 ? [{ id: location.id, label: `${node.code} · ${formatNumber(held)} ${sourceBucket}`, disabled: false }] : [];
    });

  return (
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} aria-label={label} className={selectClasses}>
      <option value="">{options.length === 0 ? (direction === "in" ? "No suitable bin" : "Not in any bin here") : "Choose a bin…"}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
