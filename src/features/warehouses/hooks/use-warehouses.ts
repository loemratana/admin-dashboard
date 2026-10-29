"use client";

import { useMemo } from "react";

import { useAuthorization } from "@/features/access-control/hooks/use-access";
import { useStore } from "@/lib/create-store";

import { locationsStore } from "../api/locations-api";
import { warehousesStore } from "../api/warehouses-api";
import { flattenTree, locationCode } from "../utils/location-utils";

// Every warehouse, for lookups (names on records the user can already see).
export const useWarehouses = () => useStore(warehousesStore);

// Only the warehouses the current user may view; warehouse-scoped roles see their own.
export function useVisibleWarehouses() {
  const warehouses = useWarehouses();
  const canDo = useAuthorization();
  return useMemo(
    () => warehouses.filter((warehouse) => canDo("inventory.warehouse.view", { warehouseId: warehouse.id })),
    [warehouses, canDo],
  );
}

export const useLocations = () => useStore(locationsStore);

// One warehouse's locations as an indented tree with full codes, e.g. CDC-A01-R02-B05.
export function useLocationTree(warehouseId: string) {
  const warehouse = useWarehouses().find((candidate) => candidate.id === warehouseId);
  const locations = useLocations();
  return useMemo(
    () => (warehouse ? flattenTree(locations.filter((location) => location.warehouseId === warehouseId), warehouse) : []),
    [locations, warehouse, warehouseId],
  );
}

// Every location's full code, for labelling ledger entries and bins anywhere.
export function useLocationCodes() {
  const warehouses = useWarehouses();
  const locations = useLocations();
  return useMemo(() => {
    const byId = new Map(locations.map((location) => [location.id, location]));
    const codes = new Map<string, string>();
    for (const location of locations) {
      const warehouse = warehouses.find((candidate) => candidate.id === location.warehouseId);
      if (warehouse) codes.set(location.id, locationCode(location, byId, warehouse));
    }
    return codes;
  }, [warehouses, locations]);
}
