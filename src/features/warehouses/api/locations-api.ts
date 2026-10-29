import { movementsStore } from "@/features/stock/api/ledger-store";
import { binUnits, computeBinLevels, onHand } from "@/features/stock/utils/stock-math";
import { createStore } from "@/lib/create-store";
import { emitEvent } from "@/lib/events";

import type { LocationType, StorageLocation } from "../types/warehouse";
import { childTypes, isEffectivelyActive, locationCode, locationTypeDisplay, nextSegmentNumber, segmentFor } from "../utils/location-utils";
import { assertCanManageWarehouse, WarehouseError, warehousesStore } from "./warehouses-api";

// Zones, aisles, racks, shelves and bins, held in memory until the backend exists.

const seed: StorageLocation[] = [];
const add = (id: string, parentId: string | null, type: LocationType, n: number, bin?: { capacity: number | null; categories?: string[]; status?: "active" | "inactive" }) =>
  seed.push({ id, warehouseId: "wh-cdc", parentId, type, segment: segmentFor(type, n), capacity: bin?.capacity ?? null, allowedCategoryIds: bin?.categories ?? [], status: bin?.status ?? "active" });
add("loc-a01", null, "aisle", 1);
add("loc-a01-r01", "loc-a01", "rack", 1);
add("loc-a01-r01-b01", "loc-a01-r01", "bin", 1, { capacity: 200 });
add("loc-a01-r01-b02", "loc-a01-r01", "bin", 2, { capacity: 100, categories: ["cat-electronics"] });
add("loc-a01-r02", "loc-a01", "rack", 2);
add("loc-a01-r02-b01", "loc-a01-r02", "bin", 1, { capacity: 150, categories: ["cat-packaging", "cat-office"] });
add("loc-a01-r02-b02", "loc-a01-r02", "bin", 2, { capacity: 150, status: "inactive" });
add("loc-a02", null, "aisle", 2);
add("loc-a02-r01", "loc-a02", "rack", 1);
add("loc-a02-r01-b01", "loc-a02-r01", "bin", 1, { capacity: 20, categories: ["cat-furniture"] });

export const locationsStore = createStore<StorageLocation[]>(seed);

const byIdMap = () => new Map(locationsStore.getState().map((location) => [location.id, location]));
const codeOf = (location: StorageLocation) => {
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === location.warehouseId);
  return warehouse ? locationCode(location, byIdMap(), warehouse) : location.segment;
};

// Stock currently in a bin, by category, from the ledger.
function binContents(locationId: string) {
  const bins = computeBinLevels(movementsStore.getState());
  const units = binUnits(bins, locationId);
  const productIdsByVariant = new Map(movementsStore.getState().map((movement) => [movement.variantId, movement.productId]));
  const variantIds = [...(bins.get(locationId) ?? new Map()).entries()].filter(([, level]) => onHand(level) !== 0).map(([variantId]) => variantId);
  return { units, productIds: new Set(variantIds.map((variantId) => productIdsByVariant.get(variantId)!)) };
}

// ---- placement: used by every stock movement into a bin -----------------------

export type PlacementItem = { categoryId: string; units: number };

// Why stock can't go into this bin, or null when it can.
export function placementProblem(warehouseId: string, locationId: string | null | undefined, items: PlacementItem[]): string | null {
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === warehouseId);
  if (!warehouse) return "Warehouse not found.";
  if (!warehouse.trackBins) return locationId ? `${warehouse.name} doesn't track bins.` : null;
  if (!locationId) return `Choose a bin: ${warehouse.name} tracks stock by bin.`;
  const location = byIdMap().get(locationId);
  if (!location || location.warehouseId !== warehouseId || location.type !== "bin") return "Choose a bin in this warehouse.";
  const code = codeOf(location);
  if (!isEffectivelyActive(location, byIdMap())) return `${code} is inactive.`;
  if (location.allowedCategoryIds.length > 0 && items.some((item) => !location.allowedCategoryIds.includes(item.categoryId))) {
    return `${code} doesn't accept this product's category.`;
  }
  if (location.capacity !== null) {
    const incoming = items.reduce((sum, item) => sum + item.units, 0);
    const free = location.capacity - binContents(locationId).units;
    if (incoming > free) return `${code} only has room for ${Math.max(free, 0)} more units.`;
  }
  return null;
}

// ---- management -----------------------------------------------------------------

export type NewLocationInput = {
  warehouseId: string;
  parentId: string | null;
  type: LocationType;
  number?: number; // defaults to the next free number
  capacity: number | null;
  allowedCategoryIds: string[];
};

function validateBinSettings(type: LocationType, capacity: number | null, categories: string[]) {
  if (type !== "bin") {
    if (capacity !== null || categories.length > 0) throw new WarehouseError("Only bins have a capacity and allowed categories.");
    return;
  }
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) throw new WarehouseError("Capacity must be a whole number above 0.");
}

export async function createLocation(actorId: string, input: NewLocationInput): Promise<StorageLocation> {
  assertCanManageWarehouse(actorId, input.warehouseId);
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === input.warehouseId);
  if (!warehouse?.trackBins) throw new WarehouseError("Turn on bin tracking for this warehouse first.");
  const parent = input.parentId ? byIdMap().get(input.parentId) : null;
  if (input.parentId && (!parent || parent.warehouseId !== warehouse.id)) throw new WarehouseError("Parent location not found.");
  if (!childTypes(parent?.type ?? null).includes(input.type)) {
    throw new WarehouseError(`A ${locationTypeDisplay[input.type].label.toLowerCase()} can't go inside a ${parent?.type}.`);
  }
  validateBinSettings(input.type, input.capacity, input.allowedCategoryIds);

  const siblings = locationsStore.getState().filter((location) => location.warehouseId === warehouse.id && location.parentId === input.parentId);
  const number = input.number ?? nextSegmentNumber(siblings, input.type);
  if (!(Number.isInteger(number) && number > 0 && number < 100)) throw new WarehouseError("Use a number from 1 to 99.");
  const segment = segmentFor(input.type, number);
  if (siblings.some((sibling) => sibling.segment === segment)) throw new WarehouseError(`${segment} already exists here.`);

  const location: StorageLocation = {
    id: `loc-${Math.random().toString(36).slice(2, 10)}`,
    warehouseId: warehouse.id,
    parentId: input.parentId,
    type: input.type,
    segment,
    capacity: input.type === "bin" ? input.capacity : null,
    allowedCategoryIds: input.type === "bin" ? input.allowedCategoryIds : [],
    status: "active",
  };
  locationsStore.setState((list) => [...list, location]);
  emitEvent("warehouse.changed", { actorId, warehouseId: warehouse.id, summary: `Added location ${codeOf(location)}` });
  return location;
}

export type LocationChanges = { capacity: number | null; allowedCategoryIds: string[]; status: "active" | "inactive" };

export async function updateLocation(actorId: string, locationId: string, changes: LocationChanges, categoryOf: (productId: string) => string | undefined): Promise<void> {
  const location = byIdMap().get(locationId);
  if (!location) throw new WarehouseError("Location not found.");
  assertCanManageWarehouse(actorId, location.warehouseId);
  validateBinSettings(location.type, changes.capacity, changes.allowedCategoryIds);
  if (location.type === "bin") {
    const contents = binContents(locationId);
    if (changes.capacity !== null && changes.capacity < contents.units) {
      throw new WarehouseError(`It already holds ${contents.units} units; capacity can't be lower.`);
    }
    if (changes.allowedCategoryIds.length > 0 && [...contents.productIds].some((productId) => !changes.allowedCategoryIds.includes(categoryOf(productId) ?? ""))) {
      throw new WarehouseError("It holds stock from a category you're excluding. Move that stock first.");
    }
  }
  locationsStore.setState((list) => list.map((candidate) => (candidate.id === locationId ? { ...candidate, ...changes } : candidate)));
  const what = location.status !== changes.status ? (changes.status === "active" ? "Reactivated" : "Deactivated") : "Updated";
  emitEvent("warehouse.changed", { actorId, warehouseId: location.warehouseId, summary: `${what} location ${codeOf(location)}` });
}

// Deleting is only for mistakes: no children and never used by stock. Otherwise deactivate.
export function deleteBlocker(locationId: string): string | null {
  if (locationsStore.getState().some((location) => location.parentId === locationId)) return "Remove what's inside it first.";
  if (movementsStore.getState().some((movement) => movement.locationId === locationId)) return "It has stock history. Deactivate it instead.";
  return null;
}

export async function deleteLocation(actorId: string, locationId: string): Promise<void> {
  const location = byIdMap().get(locationId);
  if (!location) throw new WarehouseError("Location not found.");
  assertCanManageWarehouse(actorId, location.warehouseId);
  const blocker = deleteBlocker(locationId);
  if (blocker) throw new WarehouseError(blocker);
  const code = codeOf(location);
  locationsStore.setState((list) => list.filter((candidate) => candidate.id !== locationId));
  emitEvent("warehouse.changed", { actorId, warehouseId: location.warehouseId, summary: `Deleted location ${code}` });
}
