import type { PermissionKey } from "@/config/permissions";

// How far a granted permission reaches.
//   all       - every record
//   warehouse - records in the user's assigned warehouses
//   assigned  - records assigned to the user
//   own       - records the user created
export type AccessScope = "all" | "warehouse" | "assigned" | "own";

export type Role = {
  id: string;
  name: string;
  description: string;
  // System roles can't be edited or deleted, only cloned.
  isSystem: boolean;
  grants: Partial<Record<PermissionKey, AccessScope>>;
};

export type UserStatus = "active" | "invited" | "disabled";

export type User = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roleIds: string[];
  warehouseIds: string[];
  departmentId: string | null; // see config/departments
  telegram: string; // Telegram username for notifications, e.g. "@alexchen"; "" for none
  lastLoginAt: string | null; // ISO date-time
};

// The parts of a record a scoped permission is checked against.
export type AccessRecord = {
  warehouseId?: string;
  assignedTo?: string;
  createdBy?: string;
};
