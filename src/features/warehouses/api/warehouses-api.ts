import { rolesStore, usersStore } from "@/features/access-control/api/access-api";
import { movementsStore } from "@/features/stock/api/ledger-store";
import { can } from "@/lib/authorization";
import { createStore } from "@/lib/create-store";
import { emitEvent } from "@/lib/events";

import type { WarehouseInput } from "../schemas/warehouse-schema";
import type { Warehouse } from "../types/warehouse";
import { standardHours } from "../utils/location-utils";

// Sample data held in memory until the backend exists. Mutations check the
// actor's permission themselves, as a backend endpoint would.
export const warehousesStore = createStore<Warehouse[]>([
  { id: "wh-main", code: "MAIN", name: "Main warehouse", address: "12 Industrial Road", managerId: "u-03", phone: "+1 555 0100", email: "main@example.com", hours: standardHours(), trackBins: false, status: "active" },
  { id: "wh-east", code: "EAST", name: "East depot", address: "88 Harbor Street", managerId: "u-10", phone: "+1 555 0140", email: "east@example.com", hours: [...standardHours().slice(0, 5), { open: "09:00", close: "13:00" }, null], trackBins: false, status: "active" },
  { id: "wh-cdc", code: "CDC", name: "Central DC", address: "400 Logistics Park", managerId: "u-03", phone: "+1 555 0180", email: "cdc@example.com", hours: standardHours(), trackBins: true, status: "active" },
  { id: "wh-annex", code: "ANNEX", name: "Old annex", address: "3 Mill Lane", managerId: null, phone: "", email: "", hours: standardHours(), trackBins: false, status: "inactive" },
]);

export class WarehouseError extends Error {}

export function assertCanManageWarehouse(actorId: string, warehouseId?: string) {
  const actor = usersStore.getState().find((user) => user.id === actorId);
  const allowed =
    actor && can(actor, rolesStore.getState(), "inventory.warehouse.manage", warehouseId ? { warehouseId } : undefined);
  if (!allowed) throw new WarehouseError("You can't manage this warehouse.");
}

function assertUniqueCode(code: string, exceptId?: string) {
  if (warehousesStore.getState().some((warehouse) => warehouse.id !== exceptId && warehouse.code === code)) {
    throw new WarehouseError("Another warehouse already uses this code.");
  }
}

function assertManager(managerId: string | null) {
  if (managerId && !usersStore.getState().some((user) => user.id === managerId && user.status === "active")) {
    throw new WarehouseError("Choose an active user as manager.");
  }
}

// Units held in a warehouse, all items and buckets.
export const warehouseUnits = (warehouseId: string) =>
  movementsStore
    .getState()
    .filter((movement) => movement.warehouseId === warehouseId)
    .reduce((sum, movement) => sum + movement.quantity, 0);

// Bin tracking can only be switched while the warehouse is empty: turning it on
// would leave stock without a bin, turning it off would strand stock in bins.
export function binTrackingBlocker(warehouseId: string): string | null {
  const units = warehouseUnits(warehouseId);
  return units > 0 ? `It holds ${units} units. Bin tracking can only change while it's empty.` : null;
}

export async function createWarehouse(actorId: string, input: WarehouseInput): Promise<Warehouse> {
  assertCanManageWarehouse(actorId);
  assertUniqueCode(input.code);
  assertManager(input.managerId);
  const warehouse: Warehouse = { ...input, id: `wh-${Math.random().toString(36).slice(2, 8)}`, status: "active" };
  warehousesStore.setState((list) => [...list, warehouse]);
  emitEvent("warehouse.changed", { actorId, warehouseId: warehouse.id, summary: `Created warehouse ${warehouse.code} (${warehouse.name})` });
  return warehouse;
}

export async function updateWarehouse(actorId: string, warehouseId: string, input: WarehouseInput): Promise<void> {
  assertCanManageWarehouse(actorId, warehouseId);
  assertUniqueCode(input.code, warehouseId);
  assertManager(input.managerId);
  const before = warehousesStore.getState().find((warehouse) => warehouse.id === warehouseId);
  if (!before) throw new WarehouseError("Warehouse not found.");
  if (before.trackBins !== input.trackBins) {
    const blocker = binTrackingBlocker(warehouseId);
    if (blocker) throw new WarehouseError(blocker);
  }
  warehousesStore.setState((list) =>
    list.map((warehouse) => (warehouse.id === warehouseId ? { ...warehouse, ...input } : warehouse)),
  );
  const binNote = before.trackBins !== input.trackBins ? `; bin tracking ${input.trackBins ? "on" : "off"}` : "";
  emitEvent("warehouse.changed", { actorId, warehouseId, summary: `Updated warehouse ${input.code} (${input.name})${binNote}` });
}

// At least one warehouse must stay active, and a warehouse still holding
// stock has to be emptied (transferred or adjusted) before it can be deactivated.
export function deactivationBlocker(warehouses: Warehouse[], warehouseId: string): string | null {
  const othersActive = warehouses.some((warehouse) => warehouse.id !== warehouseId && warehouse.status === "active");
  if (!othersActive) return "At least one warehouse must stay active.";
  const units = warehouseUnits(warehouseId);
  return units > 0 ? `It still holds ${units} units. Move them out first.` : null;
}

export async function setWarehouseActive(actorId: string, warehouseId: string, active: boolean): Promise<void> {
  assertCanManageWarehouse(actorId, warehouseId);
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === warehouseId);
  if (!warehouse) throw new WarehouseError("Warehouse not found.");
  if (!active) {
    const blocker = deactivationBlocker(warehousesStore.getState(), warehouseId);
    if (blocker) throw new WarehouseError(blocker);
  }
  warehousesStore.setState((list) =>
    list.map((candidate) => (candidate.id === warehouseId ? { ...candidate, status: active ? "active" : "inactive" } : candidate)),
  );
  emitEvent("warehouse.changed", {
    actorId,
    warehouseId,
    summary: `${active ? "Reactivated" : "Deactivated"} warehouse ${warehouse.code} (${warehouse.name})`,
  });
}
