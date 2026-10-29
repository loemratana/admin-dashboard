import type { PermissionKey } from "@/config/permissions";
import { can } from "@/lib/authorization";
import type { Role, User, UserStatus } from "@/types/access";

import { grantableScopes } from "./role-policy";

// Business rules for user management. Pure functions shared by the UI (to
// disable controls) and the API (to refuse the change), like role-policy.ts.

export const SUPER_ADMIN_ROLE_ID = "super-admin";

export function canManageUsers(actor: User, roles: Role[]) {
  return can(actor, roles, "access.user.manage");
}

// You can only hand someone a role whose every grant you could give yourself.
export function canAssignRole(actor: User, roles: Role[], role: Role) {
  return Object.entries(role.grants).every(([permission, scope]) =>
    grantableScopes(actor, roles, permission as PermissionKey).includes(scope),
  );
}

export type UserChange = { roleIds: string[]; status: UserStatus };

// Problems that block saving `next` for `userId` (null = inviting a new user).
export function userChangeViolations(
  actor: User,
  roles: Role[],
  users: User[],
  userId: string | null,
  next: UserChange,
): string[] {
  if (!canManageUsers(actor, roles)) return ["You can't manage users."];

  const before = userId ? users.find((user) => user.id === userId) : undefined;
  const violations: string[] = [];

  const added = next.roleIds.filter((roleId) => !before?.roleIds.includes(roleId));
  for (const roleId of added) {
    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) violations.push("That role no longer exists.");
    else if (!canAssignRole(actor, roles, role)) {
      violations.push(`You can't assign "${role.name}": it includes access you don't have.`);
    }
  }

  if (before && before.id === actor.id) {
    if (next.status !== "active") violations.push("You can't disable your own account.");
    const after: User = { ...before, roleIds: next.roleIds, status: next.status };
    if (!can(after, roles, "access.user.manage")) {
      violations.push("You can't remove your own access to user management.");
    }
  }

  // The system must always keep at least one active Super Admin.
  const activeSuperAdmins = users.filter((user) => {
    const roleIds = user.id === userId ? next.roleIds : user.roleIds;
    const status = user.id === userId ? next.status : user.status;
    return status === "active" && roleIds.includes(SUPER_ADMIN_ROLE_ID);
  });
  const wasSuperAdmin = before?.status === "active" && before.roleIds.includes(SUPER_ADMIN_ROLE_ID);
  if (wasSuperAdmin && activeSuperAdmins.length === 0) {
    violations.push("This is the last active Super Admin. Make someone else Super Admin first.");
  }

  return violations;
}
