"use client";

import { useMemo } from "react";

import type { PermissionKey } from "@/config/permissions";
import { useAuthorization } from "@/features/access-control/hooks/use-access";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";

// Warehouses where the current user holds `permission` (warehouse-scoped roles
// get only their own). Posting needs an active warehouse; viewing includes inactive ones.
export function useWarehousesWhere(permission: PermissionKey, { activeOnly = false } = {}) {
  const warehouses = useWarehouses();
  const canDo = useAuthorization();
  return useMemo(
    () =>
      warehouses.filter(
        (warehouse) => (!activeOnly || warehouse.status === "active") && canDo(permission, { warehouseId: warehouse.id }),
      ),
    [warehouses, canDo, permission, activeOnly],
  );
}
