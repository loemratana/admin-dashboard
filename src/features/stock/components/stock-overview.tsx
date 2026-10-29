"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";

import {
  DataTable,
  DataTableContent,
  DataTableEmpty,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCan } from "@/features/access-control/hooks/use-access";
import type { StockStatus } from "@/features/products/types/product";
import { getStockStatus, stockStatusDisplay } from "@/features/products/utils/stock-status";
import { useVisibleTransfers } from "@/features/transfers/hooks/use-transfers";
import { inTransit } from "@/features/transfers/types/transfer";
import { useLocationCodes, useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency, formatNumber } from "@/lib/format";

import { useMovements, useStockLevels } from "../hooks/use-stock";
import { useStockItems, type StockItem } from "../hooks/use-stock-items";
import { useWarehousesWhere } from "../hooks/use-stock-warehouses";
import type { StockLevel } from "../types/stock";
import { emptyLevel, onHand, variantLevel } from "../utils/stock-math";

type View = "item" | "location";
type Row = StockItem & {
  key: string;
  level: StockLevel;
  onHand: number;
  // Location view only: the bin code, or the warehouse code where bins aren't tracked.
  location?: string;
};

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function StockOverview() {
  const items = useStockItems();
  const levels = useStockLevels();
  const movements = useMovements();
  const allWarehouses = useWarehouses();
  const locationCodes = useLocationCodes();
  const warehouses = useWarehousesWhere("inventory.stock.view");
  const canSeeCost = useCan("products.cost.view");
  const transfers = useVisibleTransfers();
  const canSeeTransfers = useCan("inventory.transfer.view");
  const [view, setView] = useState<View>("item");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const [status, setStatus] = useState<StockStatus | "all">("all");

  // Only the warehouses this user may see count, even under "All".
  const scope = useMemo(
    () => (warehouseId === "all" ? warehouses.map((warehouse) => warehouse.id) : [warehouseId]),
    [warehouseId, warehouses],
  );

  const rows = useMemo(() => {
    const itemByVariant = new Map(items.map((item) => [item.variant.id, item]));
    let base: Row[];
    if (view === "item") {
      base = items.map((item) => {
        const level = variantLevel(levels, item.variant.id, scope);
        return { ...item, key: item.variant.id, level, onHand: onHand(level) };
      });
    } else {
      // One row per place × item, summed from the ledger.
      const byPlace = new Map<string, Row>();
      for (const movement of movements) {
        if (!scope.includes(movement.warehouseId)) continue;
        const item = itemByVariant.get(movement.variantId);
        if (!item) continue;
        const key = `${movement.locationId ?? movement.warehouseId}|${movement.variantId}`;
        const location = movement.locationId
          ? (locationCodes.get(movement.locationId) ?? "?")
          : (allWarehouses.find((warehouse) => warehouse.id === movement.warehouseId)?.code ?? "?");
        const row = byPlace.get(key) ?? { ...item, key, level: emptyLevel(), onHand: 0, location };
        row.level[movement.bucket] += movement.quantity;
        row.onHand += movement.quantity;
        byPlace.set(key, row);
      }
      base = [...byPlace.values()];
    }
    const query = search.trim().toLowerCase();
    return base
      // Hide retired items that hold nothing, and empty places.
      .filter((row) => (view === "item" ? row.usable || row.onHand !== 0 : row.onHand !== 0))
      .filter(
        (row) =>
          (!query ||
            row.label.toLowerCase().includes(query) ||
            row.variant.sku.toLowerCase().includes(query) ||
            row.variant.barcode.toLowerCase() === query ||
            (row.location?.toLowerCase().includes(query) ?? false)) &&
          (status === "all" ||
            getStockStatus({ quantity: row.onHand, available: row.level.available, reorderLevel: row.product.reorderLevel }) === status),
      )
      .sort((a, b) => (a.location ?? "").localeCompare(b.location ?? "") || a.label.localeCompare(b.label));
  }, [view, items, levels, movements, scope, search, status, locationCodes, allWarehouses]);

  const totals = rows.reduce(
    (sum, row) => ({
      onHand: sum.onHand + row.onHand,
      available: sum.available + row.level.available,
      reserved: sum.reserved + row.level.reserved,
      damaged: sum.damaged + row.level.damaged,
      quarantined: sum.quarantined + row.level.quarantined,
      value: sum.value + row.onHand * row.unitCost,
    }),
    { onHand: 0, available: 0, reserved: 0, damaged: 0, quarantined: 0, value: 0 },
  );
  const pagination = usePagination(rows, { pageSize: 15, resetKey: JSON.stringify([view, search, warehouseId, status]) });

  const number = (value: number, unit = "") => (
    <span className={value === 0 ? "text-muted-foreground" : ""}>
      {formatNumber(value)}
      {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
    </span>
  );

  const columns: DataTableColumn<Row>[] = [
    ...(view === "location"
      ? [{ id: "location", header: "Location", cell: (row: Row) => <span className="font-mono text-xs font-medium">{row.location}</span> }]
      : []),
    {
      id: "item",
      header: "Item",
      cell: (row) => (
        <div>
          <Link href={`/products/${row.product.id}`} className="font-medium hover:underline hover:underline-offset-4">
            {row.label}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.variant.sku}</p>
        </div>
      ),
    },
    { id: "onHand", header: "On hand", className: "text-right tabular-nums", cell: (row) => number(row.onHand, row.unit) },
    { id: "available", header: "Available", className: "text-right tabular-nums", cell: (row) => number(row.level.available) },
    { id: "reserved", header: "Reserved", className: "text-right tabular-nums", cell: (row) => number(row.level.reserved) },
    { id: "damaged", header: "Damaged", className: "text-right tabular-nums", cell: (row) => number(row.level.damaged) },
    { id: "quarantined", header: "Quarantined", className: "text-right tabular-nums", cell: (row) => number(row.level.quarantined) },
    ...(canSeeCost
      ? [{ id: "value", header: "Value at cost", className: "text-right tabular-nums", cell: (row: Row) => formatCurrency(row.onHand * row.unitCost) }]
      : []),
    ...(view === "item"
      ? [
          {
            id: "status",
            header: "Stock",
            cell: (row: Row) => {
              const { label, tone } = stockStatusDisplay[getStockStatus({ quantity: row.onHand, available: row.level.available, reorderLevel: row.product.reorderLevel })];
              return <StatusBadge tone={tone}>{label}</StatusBadge>;
            },
          },
        ]
      : []),
    {
      id: "history",
      header: <span className="sr-only">History</span>,
      className: "text-right",
      cell: (row) => {
        // By location: that place's history; by item: the item's.
        const query = view === "location" ? row.location! : row.variant.sku;
        return (
          <Link
            href={`/inventory/movements?q=${encodeURIComponent(query)}`}
            aria-label={`Movement history for ${view === "location" ? `${row.location} ` : ""}${row.label}`}
            className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <History className="size-4" />
          </Link>
        );
      },
    },
  ];

  const summary = [
    { label: "On hand", value: formatNumber(totals.onHand) },
    { label: "Available", value: formatNumber(totals.available) },
    { label: "Reserved", value: formatNumber(totals.reserved) },
    { label: "Damaged", value: formatNumber(totals.damaged) },
    { label: "Quarantined", value: formatNumber(totals.quarantined) },
    ...(canSeeCost ? [{ label: "Value at cost", value: formatCurrency(totals.value) }] : []),
  ];
  // Goods on the road to or from the warehouses in view. They belong to no
  // warehouse until received, so they aren't part of on hand above.
  const transitUnits = transfers
    .filter((transfer) => scope.includes(transfer.sourceWarehouseId) || scope.includes(transfer.destinationWarehouseId))
    .reduce((sum, transfer) => sum + transfer.lines.reduce((lineSum, line) => lineSum + inTransit(line), 0), 0);
  if (canSeeTransfers) summary.push({ label: "In transit", value: formatNumber(transitUnits) });

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 ${summary.length > 6 ? "xl:grid-cols-7" : "xl:grid-cols-6"}`}>
        {summary.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable>
        <DataTableToolbar>
          <DataTableSearch value={search} onChange={setSearch} placeholder="Search item, SKU, barcode or location..." />
          <select value={view} onChange={(event) => setView(event.target.value as View)} aria-label="View" className={selectClasses}>
            <option value="item">By item</option>
            <option value="location">By location</option>
          </select>
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} aria-label="Warehouse" className={selectClasses}>
            <option value="all">{warehouses.length === 1 ? warehouses[0].name : "All my warehouses"}</option>
            {warehouses.length > 1 &&
              warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StockStatus | "all")}
            aria-label="Stock level"
            className={selectClasses}
          >
            <option value="all">All stock levels</option>
            {Object.entries(stockStatusDisplay).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </DataTableToolbar>
        <DataTableContent
          columns={columns}
          rows={pagination.pageItems}
          getRowId={(row) => row.key}
          emptyState={<DataTableEmpty title="No matching stock" description="Try a different search or filter." />}
        />
        <DataTablePagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setPage}
        />
      </DataTable>
    </div>
  );
}
