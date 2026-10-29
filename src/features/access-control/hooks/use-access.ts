"use client";

import { useCallback, useMemo } from "react";

import type { PermissionKey } from "@/config/permissions";
import { can } from "@/lib/authorization";
import { useStore } from "@/lib/create-store";
import type { AccessRecord } from "@/types/access";

import { currentUserIdStore, rolesStore, usersStore } from "../api/access-api";
// Registers the audit log's event listeners.
import "../api/audit-api";

export const useUsers = () => useStore(usersStore);
export const useRoles = () => useStore(rolesStore);

export function useCurrentUser() {
  const users = useUsers();
  const roles = useRoles();
  const currentUserId = useStore(currentUserIdStore);

  return useMemo(() => {
    const user = users.find((candidate) => candidate.id === currentUserId) ?? users[0];
    return { user, roles: roles.filter((role) => user.roleIds.includes(role.id)) };
  }, [users, roles, currentUserId]);
}

// Returns a checker bound to the current user: canDo("products.product.update", record?).
export function useAuthorization() {
  const { user, roles } = useCurrentUser();
  return useCallback(
    (permission: PermissionKey, record?: AccessRecord) => can(user, roles, permission, record),
    [user, roles],
  );
}

export function useCan(permission: PermissionKey, record?: AccessRecord) {
  return useAuthorization()(permission, record);
}
