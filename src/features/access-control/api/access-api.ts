import { allPermissions, type PermissionKey } from "@/config/permissions";
import { createStore } from "@/lib/create-store";
import { emitEvent } from "@/lib/events";
import type { AccessScope, Role, User, UserStatus } from "@/types/access";

import { canDeleteRole, diffGrants, roleChangeViolations } from "../policies/role-policy";
import { canManageUsers, userChangeViolations, type UserChange } from "../policies/user-policy";
import type { UserInput } from "../schemas/user-schema";

// Roles and users held in memory until the backend exists. This seed is the
// suggested starting policy; roles stay configurable (role management, step 2).

type Grants = Role["grants"];

const grant = (scope: AccessScope, ...keys: PermissionKey[]): Grants =>
  Object.fromEntries(keys.map((key) => [key, scope]));

const everything = grant("all", ...allPermissions);
const catalogView: PermissionKey[] = ["catalog.category.view", "catalog.brand.view", "catalog.unit.view"];

export const rolesStore = createStore<Role[]>([
  {
    id: "super-admin",
    name: "Super Admin",
    description: "Full system access, security, configuration and role management.",
    isSystem: true,
    grants: everything,
  },
  {
    id: "admin",
    name: "Admin",
    description: "Runs business operations, users, inventory and reports. Can't change role definitions.",
    isSystem: true,
    grants: Object.fromEntries(Object.entries(everything).filter(([key]) => key !== "access.role.manage")),
  },
  {
    id: "inventory-manager",
    name: "Inventory Manager",
    description: "Oversees stock, transfers, adjustments and stocktaking.",
    isSystem: true,
    grants: grant(
      "all",
      "dashboard.overview.view",
      "products.product.view",
      "products.product.update",
      "products.product.export",
      "products.variant.manage",
      "products.cost.view",
      "catalog.category.view",
      "catalog.category.manage",
      "catalog.brand.view",
      "catalog.brand.manage",
      "catalog.unit.view",
      "catalog.unit.manage",
      "inventory.warehouse.view",
      "inventory.warehouse.manage",
      "inventory.stock.view",
      "inventory.movement.receive",
      "inventory.movement.issue",
      "inventory.adjustment.request",
      "inventory.adjustment.approve",
      "inventory.transfer.view",
      "inventory.transfer.create",
      "inventory.transfer.approve",
      "inventory.transfer.execute",
      "inventory.count.perform",
      "inventory.count.approve",
      "inventory.valuation.view",
      "purchasing.order.view",
      "sales.order.view",
      "reports.inventory.view",
      "reports.report.export",
      "approvals.rule.view",
      "alerts.alert.view",
      "alerts.alert.acknowledge",
      "alerts.alert.manage",
      "automation.rule.view",
      "automation.rule.manage",
    ),
  },
  {
    id: "warehouse-staff",
    name: "Warehouse Staff",
    description: "Receives, picks, issues and counts stock in their assigned warehouses.",
    isSystem: true,
    grants: {
      ...grant("all", "dashboard.overview.view", "products.product.view", ...catalogView, "alerts.alert.view"),
      ...grant(
        "warehouse",
        "inventory.warehouse.view",
        "inventory.stock.view",
        "inventory.movement.receive",
        "inventory.movement.issue",
        "inventory.adjustment.request",
        "inventory.transfer.view",
        "inventory.count.perform",
      ),
      ...grant(
        "assigned",
        "inventory.transfer.execute",
        "purchasing.order.receive",
        "sales.order.fulfill",
        "alerts.alert.acknowledge",
      ),
    },
  },
  {
    id: "purchasing-manager",
    name: "Purchasing Manager",
    description: "Suppliers, purchase orders, approvals and receiving oversight.",
    isSystem: true,
    grants: grant(
      "all",
      "dashboard.overview.view",
      "products.product.view",
      "products.cost.view",
      ...catalogView,
      "inventory.warehouse.view",
      "inventory.stock.view",
      "inventory.transfer.view",
      "purchasing.supplier.view",
      "purchasing.supplier.manage",
      "purchasing.order.view",
      "purchasing.order.create",
      "purchasing.order.approve",
      "purchasing.order.receive",
      "approvals.rule.view",
      "reports.purchasing.view",
      "reports.report.export",
      "alerts.alert.view",
      "alerts.alert.acknowledge",
      "automation.rule.view",
      "automation.rule.manage",
    ),
  },
  {
    id: "sales-manager",
    name: "Sales Manager",
    description: "Sales orders, customers, returns and fulfillment.",
    isSystem: true,
    grants: grant(
      "all",
      "dashboard.overview.view",
      "products.product.view",
      ...catalogView,
      "inventory.warehouse.view",
      "inventory.stock.view",
      "sales.customer.view",
      "sales.customer.manage",
      "sales.order.view",
      "sales.order.create",
      "sales.order.fulfill",
      "sales.return.manage",
      "reports.sales.view",
      "reports.report.export",
      "alerts.alert.view",
      "alerts.alert.acknowledge",
      "automation.rule.view",
    ),
  },
  {
    id: "sales-staff",
    name: "Sales Staff",
    description: "Creates orders and manages customers; sees only their own orders and returns.",
    isSystem: true,
    grants: {
      ...grant(
        "all",
        "dashboard.overview.view",
        "products.product.view",
        ...catalogView,
        "inventory.stock.view",
        "sales.customer.view",
        "sales.customer.manage",
        "sales.order.create",
        "reports.sales.view",
        "alerts.alert.view",
      ),
      ...grant("own", "sales.order.view", "sales.return.manage"),
    },
  },
  {
    id: "accountant",
    name: "Accountant",
    description: "Inventory valuation, purchase costs and financial reports. Read-only on operations.",
    isSystem: true,
    grants: grant(
      "all",
      "dashboard.overview.view",
      "products.product.view",
      "products.product.export",
      "products.cost.view",
      ...catalogView,
      "inventory.warehouse.view",
      "inventory.stock.view",
      "inventory.valuation.view",
      "purchasing.supplier.view",
      "purchasing.order.view",
      "sales.order.view",
      "reports.inventory.view",
      "reports.purchasing.view",
      "reports.sales.view",
      "reports.financial.view",
      "reports.report.export",
      "approvals.rule.view",
      "alerts.alert.view",
    ),
  },
  {
    id: "auditor",
    name: "Auditor",
    description: "Read-only access to every record and the access audit history.",
    isSystem: true,
    grants: grant("all", ...allPermissions.filter((key) => key.endsWith(".view"))),
  },
]);

export const usersStore = createStore<User[]>([
  { id: "u-01", name: "Jordan Lee", email: "jordan@example.com", status: "active", roleIds: ["super-admin"], warehouseIds: [], departmentId: "dept-management", telegram: "", lastLoginAt: "2026-10-26T08:12:00Z" },
  { id: "u-02", name: "Sam Rivera", email: "sam@example.com", status: "active", roleIds: ["admin"], warehouseIds: [], departmentId: "dept-management", telegram: "", lastLoginAt: "2026-10-26T09:30:00Z" },
  { id: "u-03", name: "Alex Chen", email: "alex@example.com", status: "active", roleIds: ["inventory-manager"], warehouseIds: ["wh-main", "wh-east"], departmentId: "dept-operations", telegram: "@alexchen", lastLoginAt: "2026-10-26T07:55:00Z" },
  { id: "u-04", name: "Riley Brooks", email: "riley@example.com", status: "active", roleIds: ["warehouse-staff"], warehouseIds: ["wh-main"], departmentId: "dept-operations", telegram: "", lastLoginAt: "2026-10-26T06:40:00Z" },
  { id: "u-05", name: "Casey Morgan", email: "casey@example.com", status: "active", roleIds: ["purchasing-manager"], warehouseIds: [], departmentId: "dept-purchasing", telegram: "@casey_buys", lastLoginAt: "2026-10-25T16:05:00Z" },
  { id: "u-06", name: "Taylor Kim", email: "taylor@example.com", status: "active", roleIds: ["sales-manager"], warehouseIds: [], departmentId: "dept-sales", telegram: "", lastLoginAt: "2026-10-25T14:20:00Z" },
  { id: "u-07", name: "Jamie Patel", email: "jamie@example.com", status: "active", roleIds: ["sales-staff"], warehouseIds: [], departmentId: "dept-sales", telegram: "", lastLoginAt: "2026-10-26T10:02:00Z" },
  { id: "u-08", name: "Morgan Diaz", email: "morgan@example.com", status: "active", roleIds: ["accountant"], warehouseIds: [], departmentId: "dept-finance", telegram: "@morgan_fin", lastLoginAt: "2026-10-24T11:45:00Z" },
  { id: "u-09", name: "Avery Quinn", email: "avery@example.com", status: "active", roleIds: ["auditor"], warehouseIds: [], departmentId: null, telegram: "", lastLoginAt: "2026-10-20T13:00:00Z" },
  // A small business combining two roles: permissions from both apply.
  { id: "u-10", name: "Drew Santos", email: "drew@example.com", status: "active", roleIds: ["sales-staff", "warehouse-staff"], warehouseIds: ["wh-east"], departmentId: "dept-operations", telegram: "@drew_east", lastLoginAt: "2026-10-26T09:10:00Z" },
  { id: "u-11", name: "Pat Owens", email: "pat@example.com", status: "disabled", roleIds: ["warehouse-staff"], warehouseIds: ["wh-main"], departmentId: "dept-operations", telegram: "", lastLoginAt: "2026-09-30T15:00:00Z" },
]);

// Stand-in for the signed-in session until authentication exists.
export const currentUserIdStore = createStore<string>("u-02");

// "View as": switch the simulated session to another active user.
export function switchCurrentUser(userId: string) {
  const fromUserId = currentUserIdStore.getState();
  const target = usersStore.getState().find((user) => user.id === userId);
  if (!target || target.status !== "active" || fromUserId === userId) return;
  currentUserIdStore.setState(() => userId);
  emitEvent("session.switched", { fromUserId, toUserId: userId });
}

// --- Role management -------------------------------------------------------
// Every mutation re-checks the role policy before writing, as a backend must:
// the UI's disabled controls are a convenience, not the protection.

export type RoleInput = Pick<Role, "name" | "description" | "grants">;

export class AccessError extends Error {}

function actorAndRoles(actorId: string) {
  const actor = usersStore.getState().find((user) => user.id === actorId);
  if (!actor) throw new AccessError("Unknown user.");
  return { actor, roles: rolesStore.getState() };
}

function assertUniqueName(name: string, exceptId?: string) {
  const taken = rolesStore
    .getState()
    .some((role) => role.id !== exceptId && role.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (taken) throw new AccessError("A role with this name already exists.");
}

const grantCount = (grants: Role["grants"]) => {
  const count = Object.keys(grants).length;
  return `${count} ${count === 1 ? "permission" : "permissions"}`;
};

export async function createRole(actorId: string, input: RoleInput): Promise<Role> {
  const { actor, roles } = actorAndRoles(actorId);
  const violations = roleChangeViolations(actor, roles, null, input.grants);
  if (violations.length > 0) throw new AccessError(violations[0]);
  assertUniqueName(input.name);

  const role: Role = { ...input, id: `role-${Math.random().toString(36).slice(2, 8)}`, isSystem: false };
  rolesStore.setState((list) => [...list, role]);
  emitEvent("role.created", { actorId, roleId: role.id, roleName: role.name, detail: grantCount(role.grants) });
  return role;
}

export async function updateRole(actorId: string, roleId: string, input: RoleInput): Promise<void> {
  const { actor, roles } = actorAndRoles(actorId);
  const before = roles.find((role) => role.id === roleId);
  if (!before) throw new AccessError("Role not found.");
  const violations = roleChangeViolations(actor, roles, roleId, input.grants);
  if (violations.length > 0) throw new AccessError(violations[0]);
  assertUniqueName(input.name, roleId);

  rolesStore.setState((list) => list.map((role) => (role.id === roleId ? { ...role, ...input } : role)));
  const changes = diffGrants(before.grants, input.grants);
  const added = changes.filter((change) => !change.from).length;
  const removed = changes.filter((change) => !change.to).length;
  const rescoped = changes.length - added - removed;
  const renamed = before.name !== input.name ? `renamed from "${before.name}", ` : "";
  emitEvent("role.updated", {
    actorId,
    roleId,
    roleName: input.name,
    detail: `${renamed}${added} added, ${removed} removed, ${rescoped} scope changes`,
  });
}

export async function cloneRole(actorId: string, roleId: string): Promise<Role> {
  const source = rolesStore.getState().find((role) => role.id === roleId);
  if (!source) throw new AccessError("Role not found.");
  const names = new Set(rolesStore.getState().map((role) => role.name.toLowerCase()));
  let name = `Copy of ${source.name}`;
  for (let n = 2; names.has(name.toLowerCase()); n += 1) name = `Copy of ${source.name} (${n})`;
  // Cloning is creating: the escalation check applies to every copied grant.
  return createRole(actorId, { name, description: source.description, grants: { ...source.grants } });
}

export async function deleteRole(actorId: string, roleId: string): Promise<void> {
  const { actor, roles } = actorAndRoles(actorId);
  const role = roles.find((candidate) => candidate.id === roleId);
  if (!role) throw new AccessError("Role not found.");
  if (!canDeleteRole(actor, roles, usersStore.getState(), role)) {
    throw new AccessError(role.isSystem ? "System roles can't be deleted." : "Only unused custom roles can be deleted.");
  }
  rolesStore.setState((list) => list.filter((candidate) => candidate.id !== roleId));
  emitEvent("role.deleted", { actorId, roleId, roleName: role.name, detail: grantCount(role.grants) });
}

// --- User management -------------------------------------------------------

function assertUniqueEmail(email: string, exceptId?: string) {
  if (usersStore.getState().some((user) => user.id !== exceptId && user.email.toLowerCase() === email.toLowerCase())) {
    throw new AccessError("Another user already has this email.");
  }
}

function checkUserChange(actorId: string, userId: string | null, change: UserChange) {
  const { actor, roles } = actorAndRoles(actorId);
  const violations = userChangeViolations(actor, roles, usersStore.getState(), userId, change);
  if (violations.length > 0) throw new AccessError(violations[0]);
}

const roleNames = (roleIds: string[]) =>
  roleIds.map((id) => rolesStore.getState().find((role) => role.id === id)?.name ?? id).join(", ");

export async function inviteUser(actorId: string, input: UserInput): Promise<User> {
  checkUserChange(actorId, null, { roleIds: input.roleIds, status: "invited" });
  assertUniqueEmail(input.email);
  const user: User = { ...input, id: `u-${Math.random().toString(36).slice(2, 8)}`, status: "invited", lastLoginAt: null };
  usersStore.setState((list) => [...list, user]);
  emitEvent("user.invited", { actorId, userId: user.id, userName: user.name, detail: `roles: ${roleNames(user.roleIds)}` });
  return user;
}

export async function updateUser(actorId: string, userId: string, input: UserInput): Promise<void> {
  const before = usersStore.getState().find((user) => user.id === userId);
  if (!before) throw new AccessError("User not found.");
  checkUserChange(actorId, userId, { roleIds: input.roleIds, status: before.status });
  assertUniqueEmail(input.email, userId);
  usersStore.setState((list) => list.map((user) => (user.id === userId ? { ...user, ...input } : user)));

  // Record exactly which access was granted or removed, and by whom (the actor).
  const granted = input.roleIds.filter((id) => !before.roleIds.includes(id));
  const removed = before.roleIds.filter((id) => !input.roleIds.includes(id));
  const parts = [
    granted.length > 0 && `granted ${roleNames(granted)}`,
    removed.length > 0 && `removed ${roleNames(removed)}`,
    before.warehouseIds.join() !== input.warehouseIds.join() && "warehouses changed",
    before.departmentId !== input.departmentId && "department changed",
    before.telegram !== input.telegram && "Telegram changed",
    (before.name !== input.name || before.email !== input.email) && "details changed",
  ].filter(Boolean);
  emitEvent("user.updated", { actorId, userId, userName: input.name, detail: parts.join("; ") || "no changes" });
}

export async function setUserEnabled(actorId: string, userId: string, enabled: boolean): Promise<void> {
  const user = usersStore.getState().find((candidate) => candidate.id === userId);
  if (!user) throw new AccessError("User not found.");
  // Re-enabling an invited user keeps them invited; disabling ends any access.
  const status: UserStatus = enabled ? (user.lastLoginAt ? "active" : "invited") : "disabled";
  checkUserChange(actorId, userId, { roleIds: user.roleIds, status });
  usersStore.setState((list) => list.map((candidate) => (candidate.id === userId ? { ...candidate, status } : candidate)));
  emitEvent(enabled ? "user.enabled" : "user.disabled", { actorId, userId, userName: user.name, detail: "" });
}

export async function resendInvite(actorId: string, userId: string): Promise<void> {
  const { actor, roles } = actorAndRoles(actorId);
  const user = usersStore.getState().find((candidate) => candidate.id === userId);
  if (!user || user.status !== "invited") throw new AccessError("Only pending invites can be resent.");
  if (!canManageUsers(actor, roles)) throw new AccessError("You can't manage users.");
  emitEvent("user.inviteResent", { actorId, userId, userName: user.name, detail: user.email });
}

// Assign or remove one warehouse from a user (the warehouse page's "Assigned users").
export async function setWarehouseAssignment(actorId: string, userId: string, warehouseId: string, warehouseLabel: string, assigned: boolean): Promise<void> {
  const { actor, roles } = actorAndRoles(actorId);
  if (!canManageUsers(actor, roles)) throw new AccessError("You can't manage users.");
  const user = usersStore.getState().find((candidate) => candidate.id === userId);
  if (!user) throw new AccessError("User not found.");
  if (user.warehouseIds.includes(warehouseId) === assigned) return;
  const warehouseIds = assigned ? [...user.warehouseIds, warehouseId] : user.warehouseIds.filter((id) => id !== warehouseId);
  usersStore.setState((list) => list.map((candidate) => (candidate.id === userId ? { ...candidate, warehouseIds } : candidate)));
  emitEvent("user.updated", {
    actorId,
    userId,
    userName: user.name,
    detail: assigned ? `assigned to ${warehouseLabel}` : `removed from ${warehouseLabel}`,
  });
}
