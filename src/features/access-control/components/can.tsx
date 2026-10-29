"use client";

import type { PermissionKey } from "@/config/permissions";
import type { AccessRecord } from "@/types/access";

import { useCan } from "../hooks/use-access";

type CanProps = {
  permission: PermissionKey;
  record?: AccessRecord;
  children: React.ReactNode;
  // Rendered instead when access is missing; nothing by default.
  fallback?: React.ReactNode;
};

// Shows its children only when the current user has the permission. UI only:
// the backend must enforce the same rule.
export function Can({ permission, record, children, fallback = null }: CanProps) {
  return useCan(permission, record) ? children : fallback;
}
