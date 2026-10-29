import { allPermissions, permissionLabel, type PermissionKey } from "@/config/permissions";
import { can, grantedScopes, scopeOrder, widestScope } from "@/lib/authorization";
import type { AccessScope, Role, User } from "@/types/access";

// Business rules for role management (policy-based authorization). Pure
// functions: the UI uses them to disable controls, and the API runs them again
// before saving, exactly as a backend would.

export type Grants = Role["grants"];

export type GrantChange = {
  permission: PermissionKey;
  from: AccessScope | null;
  to: AccessScope | null;
};

export function diffGrants(before: Grants, after: Grants): GrantChange[] {
  return allPermissions.flatMap((permission) => {
    const from = before[permission] ?? null;
    const to = after[permission] ?? null;
    return from === to ? [] : [{ permission, from, to }];
  });
}

export const scopeLabels: Record<AccessScope, string> = {
  all: "All records",
  warehouse: "Their warehouses",
  assigned: "Assigned to them",
  own: "Created by them",
};

// No privilege escalation: you can only hand out a permission up to the widest
// scope you hold yourself.
export function grantableScopes(actor: User, allRoles: Role[], permission: PermissionKey): AccessScope[] {
  const widest = widestScope(grantedScopes(actor, allRoles, permission));
  return widest ? scopeOrder.slice(0, scopeOrder.indexOf(widest) + 1) : [];
}

export function canManageRoles(actor: User, allRoles: Role[]) {
  return can(actor, allRoles, "access.role.manage");
}

// System roles are protected: they can be viewed and cloned, never changed.
export function canEditRole(actor: User, allRoles: Role[], role: Role | undefined) {
  return canManageRoles(actor, allRoles) && (!role || !role.isSystem);
}

export function canDeleteRole(actor: User, allRoles: Role[], users: User[], role: Role) {
  return canEditRole(actor, allRoles, role) && !users.some((user) => user.roleIds.includes(role.id));
}

// Problems that block saving `nextGrants` for `roleId` (null = a new role).
export function roleChangeViolations(
  actor: User,
  allRoles: Role[],
  roleId: string | null,
  nextGrants: Grants,
): string[] {
  const role = roleId ? allRoles.find((candidate) => candidate.id === roleId) : undefined;
  if (!canEditRole(actor, allRoles, role)) {
    return [role?.isSystem ? "System roles can't be changed. Clone it instead." : "You can't manage roles."];
  }

  const violations: string[] = [];
  for (const change of diffGrants(role?.grants ?? {}, nextGrants)) {
    if (change.to && !grantableScopes(actor, allRoles, change.permission).includes(change.to)) {
      violations.push(
        `You can't grant "${permissionLabel(change.permission)}" for ${scopeLabels[change.to].toLowerCase()}: it's more access than you have.`,
      );
    }
  }

  // No self-lockout: removing role management from your own role, with no other role still granting it.
  if (role && actor.roleIds.includes(role.id) && role.grants["access.role.manage"] && !nextGrants["access.role.manage"]) {
    const otherRoles = allRoles.filter((candidate) => candidate.id !== role.id);
    if (!can(actor, otherRoles, "access.role.manage")) {
      violations.push(`Removing "${permissionLabel("access.role.manage")}" would lock you out of role management.`);
    }
  }
  return violations;
}
