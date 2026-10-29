// Every permission in the system, named module.resource.action and grouped by
// module for the role editor. Roles grant these keys; code checks them with can().
// Add a module's permissions here when the module is built.
export const permissionModules = [
  {
    id: "dashboard",
    label: "Dashboard",
    permissions: [{ key: "dashboard.overview.view", label: "View dashboard" }],
  },
  {
    id: "products",
    label: "Products",
    permissions: [
      { key: "products.product.view", label: "View products" },
      { key: "products.product.create", label: "Create products" },
      { key: "products.product.update", label: "Edit products" },
      { key: "products.product.archive", label: "Archive and restore products" },
      { key: "products.product.export", label: "Export products" },
      { key: "products.variant.manage", label: "Manage product variants" },
      { key: "products.cost.view", label: "See cost prices and margins" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    permissions: [
      { key: "catalog.category.view", label: "View categories" },
      { key: "catalog.category.manage", label: "Manage categories" },
      { key: "catalog.brand.view", label: "View brands" },
      { key: "catalog.brand.manage", label: "Manage brands" },
      { key: "catalog.unit.view", label: "View units" },
      { key: "catalog.unit.manage", label: "Manage units" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    permissions: [
      { key: "inventory.warehouse.view", label: "View warehouses" },
      { key: "inventory.warehouse.manage", label: "Manage warehouses" },
      { key: "inventory.stock.view", label: "View stock levels" },
      { key: "inventory.movement.receive", label: "Receive stock" },
      { key: "inventory.movement.issue", label: "Issue stock" },
      { key: "inventory.adjustment.request", label: "Request stock adjustments" },
      { key: "inventory.adjustment.approve", label: "Approve stock adjustments" },
      { key: "inventory.transfer.view", label: "View transfers" },
      { key: "inventory.transfer.create", label: "Create transfers" },
      { key: "inventory.transfer.approve", label: "Approve transfers" },
      { key: "inventory.transfer.execute", label: "Execute transfers (dispatch and receive)" },
      { key: "inventory.count.perform", label: "Perform stock counts" },
      { key: "inventory.count.approve", label: "Approve stock counts" },
      { key: "inventory.valuation.view", label: "View inventory valuation" },
    ],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    permissions: [
      { key: "purchasing.supplier.view", label: "View suppliers" },
      { key: "purchasing.supplier.manage", label: "Manage suppliers" },
      { key: "purchasing.order.view", label: "View purchase orders" },
      { key: "purchasing.order.create", label: "Create purchase orders" },
      { key: "purchasing.order.approve", label: "Approve purchase orders" },
      { key: "purchasing.order.receive", label: "Receive purchase orders" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    permissions: [
      { key: "sales.customer.view", label: "View customers" },
      { key: "sales.customer.manage", label: "Manage customers" },
      { key: "sales.order.view", label: "View sales orders" },
      { key: "sales.order.create", label: "Create sales orders" },
      { key: "sales.order.fulfill", label: "Fulfill sales orders" },
      { key: "sales.return.manage", label: "Manage returns" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    permissions: [
      { key: "reports.inventory.view", label: "Inventory reports" },
      { key: "reports.purchasing.view", label: "Purchasing reports" },
      { key: "reports.sales.view", label: "Sales reports" },
      { key: "reports.financial.view", label: "Financial reports" },
      { key: "reports.report.export", label: "Export reports" },
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    permissions: [
      { key: "approvals.request.view", label: "View all approval requests" },
      { key: "approvals.rule.view", label: "View approval rules" },
      { key: "approvals.rule.manage", label: "Manage approval rules" },
      { key: "approvals.notification.view", label: "View notification outbox" },
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    permissions: [
      { key: "alerts.alert.view", label: "View alerts" },
      { key: "alerts.alert.acknowledge", label: "Acknowledge alerts" },
      { key: "alerts.alert.manage", label: "Manage alert settings" },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    permissions: [
      { key: "automation.rule.view", label: "View automation rules" },
      { key: "automation.rule.manage", label: "Manage automation rules" },
    ],
  },
  {
    id: "access",
    label: "Users & access",
    permissions: [
      { key: "access.user.view", label: "View users" },
      { key: "access.user.manage", label: "Manage users" },
      { key: "access.role.view", label: "View roles" },
      { key: "access.role.manage", label: "Manage roles and permissions" },
      { key: "access.audit.view", label: "View access audit log" },
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  permissions: readonly { key: `${string}.${string}.${string}`; label: string }[];
}[];

export type PermissionKey = (typeof permissionModules)[number]["permissions"][number]["key"];

export const allPermissions: PermissionKey[] = permissionModules.flatMap((module) =>
  module.permissions.map((permission) => permission.key),
);

const labels = new Map<string, string>(
  permissionModules.flatMap((module) => module.permissions.map((permission) => [permission.key, permission.label])),
);

export const permissionLabel = (key: PermissionKey) => labels.get(key) ?? key;
