"use client";

import { useMemo, useState } from "react";

import {
  DataTable,
  DataTableContent,
  DataTableEmpty,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { useCan, useUsers } from "@/features/access-control/hooks/use-access";
import { useLocationCodes, useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

import { useMovements } from "../hooks/use-stock";
import { useStockItems } from "../hooks/use-stock-items";
import { useWarehousesWhere } from "../hooks/use-stock-warehouses";
import type { MovementType, StockMovement } from "../types/stock";

export const movementTypeDisplay: Record<MovementType, { label: string; tone: StatusTone }> = {
  opening: { label: "Opening", tone: "neutral" },
  receipt: { label: "Stock in", tone: "success" },
  issue: { label: "Stock out", tone: "info" },
  adjustment: { label: "Adjustment", tone: "warning" },
  reservation: { label: "Reservation", tone: "neutral" },
  "variant-change": { label: "Variant change", tone: "neutral" },
  "transfer-out": { label: "Transfer out", tone: "info" },
  "transfer-in": { label: "Transfer in", tone: "success" },
  "transfer-loss": { label: "Lost in transit", tone: "danger" },
  count: { label: "Count variance", tone: "warning" },
};

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function MovementsLedger({ initialQuery = "" }: { initialQuery?: string }) {
  const movements = useMovements();
  const items = useStockItems();
  const users = useUsers();
  const allWarehouses = useWarehouses();
  const visibleWarehouses = useWarehousesWhere("inventory.stock.view");
  const canSeeCost = useCan("products.cost.view");
  const locationCodes = useLocationCodes();
  const [search, setSearch] = useState(initialQuery);
  const [warehouseId, setWarehouseId] = useState("all");
  const [type, setType] = useState<MovementType | "all">("all");

  const itemByVariant = useMemo(() => new Map(items.map((item) => [item.variant.id, item])), [items]);
  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? id;
  const warehouseCode = (id: string) => allWarehouses.find((warehouse) => warehouse.id === id)?.code ?? id;

  const rows = useMemo(() => {
    const visible = new Set(visibleWarehouses.map((warehouse) => warehouse.id));
    const query = search.trim().toLowerCase();
    return movements
      .filter((movement) => visible.has(movement.warehouseId))
      .filter((movement) => {
        if (warehouseId !== "all" && movement.warehouseId !== warehouseId) return false;
        if (type !== "all" && movement.type !== type) return false;
        if (!query) return true;
        const item = itemByVariant.get(movement.variantId);
        const location = movement.locationId ? locationCodes.get(movement.locationId) : undefined;
        return [item?.label, item?.variant.sku, item?.variant.barcode, movement.reference, movement.reason, location]
          .some((text) => text?.toLowerCase().includes(query));
      })
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  }, [movements, visibleWarehouses, warehouseId, type, search, itemByVariant, locationCodes]);

  const pagination = usePagination(rows, { pageSize: 20, resetKey: JSON.stringify([search, warehouseId, type]) });

  const columns: DataTableColumn<StockMovement>[] = [
    { id: "at", header: "Date", cell: (movement) => <span className="text-muted-foreground">{formatDateTime(movement.at)}</span> },
    {
      id: "type",
      header: "Type",
      cell: (movement) => {
        const { label, tone } = movementTypeDisplay[movement.type];
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      id: "item",
      header: "Item",
      cell: (movement) => {
        const item = itemByVariant.get(movement.variantId);
        return (
          <div>
            <p className="font-medium">{item?.label ?? "Removed variant"}</p>
            <p className="font-mono text-xs text-muted-foreground">{item?.variant.sku}</p>
          </div>
        );
      },
    },
    {
      id: "warehouse",
      header: "Location",
      cell: (movement) => (
        <span className="font-mono text-xs">
          {movement.locationId ? (locationCodes.get(movement.locationId) ?? warehouseCode(movement.warehouseId)) : warehouseCode(movement.warehouseId)}
        </span>
      ),
    },
    {
      id: "quantity",
      header: "Qty",
      className: "text-right tabular-nums",
      cell: (movement) => (
        <span>
          <span className="font-medium">
            {movement.quantity > 0 ? "+" : "−"}
            {formatNumber(Math.abs(movement.quantity))}
          </span>
          {movement.bucket !== "available" && <span className="ml-1 text-xs text-muted-foreground">{movement.bucket}</span>}
        </span>
      ),
    },
    ...(canSeeCost
      ? [
          {
            id: "cost",
            header: "Unit cost",
            className: "text-right tabular-nums",
            cell: (movement: StockMovement) =>
              movement.unitCost === null ? <span className="text-muted-foreground">—</span> : formatCurrency(movement.unitCost),
          },
        ]
      : []),
    { id: "reference", header: "Reference", cell: (movement) => <span className="font-mono text-xs">{movement.reference}</span> },
    {
      id: "reason",
      header: "Reason",
      className: "whitespace-normal",
      cell: (movement) => <span className="text-muted-foreground">{movement.reason || "—"}</span>,
    },
    { id: "by", header: "By", cell: (movement) => nameOf(movement.actorId) },
  ];

  return (
    <DataTable>
      <DataTableToolbar>
        <DataTableSearch value={search} onChange={setSearch} placeholder="Search item, SKU, reference or location..." />
        <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} aria-label="Warehouse" className={selectClasses}>
          <option value="all">{visibleWarehouses.length === 1 ? visibleWarehouses[0].name : "All my warehouses"}</option>
          {visibleWarehouses.length > 1 &&
            visibleWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value as MovementType | "all")} aria-label="Movement type" className={selectClasses}>
          <option value="all">All types</option>
          {Object.entries(movementTypeDisplay).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </DataTableToolbar>
      <DataTableContent
        columns={columns}
        rows={pagination.pageItems}
        getRowId={(movement) => movement.id}
        emptyState={<DataTableEmpty title="No movements" description="Try a different search or filter." />}
      />
      <DataTablePagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        onPageChange={pagination.setPage}
      />
    </DataTable>
  );
}
