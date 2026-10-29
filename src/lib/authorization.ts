import type { PermissionKey } from "@/config/permissions";
import type { AccessRecord, AccessScope, Role, User } from "@/types/access";

// Pure authorization rules: no React and no data fetching, so a backend can run
// exactly the same checks. In the browser these only shape the UI; real
// enforcement has to happen on the server.

// Narrowest to widest.
export const scopeOrder: AccessScope[] = ["own", "assigned", "warehouse", "all"];

// Every scope the user's roles grant for a permission. Several roles combine:
// a user may act wherever any of their roles allows.
export function grantedScopes(user: User, roles: Role[], permission: PermissionKey): AccessScope[] {
  if (user.status !== "active") return [];
  const scopes = new Set<AccessScope>();
  for (const role of roles) {
    if (!user.roleIds.includes(role.id)) continue;
    const scope = role.grants[permission];
    if (scope) scopes.add(scope);
  }
  return scopeOrder.filter((scope) => scopes.has(scope));
}

export function widestScope(scopes: AccessScope[]): AccessScope | null {
  return scopes.length > 0 ? scopes[scopes.length - 1] : null;
}

function scopeAllows(scope: AccessScope, user: User, record: AccessRecord) {
  switch (scope) {
    case "all":
      return true;
    case "warehouse":
      return record.warehouseId !== undefined && user.warehouseIds.includes(record.warehouseId);
    case "assigned":
      return record.assignedTo === user.id;
    case "own":
      return record.createdBy === user.id;
  }
}

// Deny by default. Without a record: "may the user do this to at least some
// records?" (decides whether to show the action). With a record: "may the user
// do this to this record?".
export function can(user: User, roles: Role[], permission: PermissionKey, record?: AccessRecord): boolean {
  const scopes = grantedScopes(user, roles, permission);
  if (scopes.length === 0) return false;
  if (!record) return true;
  return scopes.some((scope) => scopeAllows(scope, user, record));
}
