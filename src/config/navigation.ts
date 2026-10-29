import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BellRing,
  CheckSquare,
  Award,
  Boxes,
  Calculator,
  ChartColumn,
  ClipboardCheck,
  History,
  Inbox,
  ListChecks,
  LayoutDashboard,
  Package,
  PackageSearch,
  Ruler,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { PermissionKey } from "./permissions";

export type NavLink = {
  title: string;
  href: string;
  icon: LucideIcon;
  // Set to true once the route's page exists; unavailable items render as "Soon".
  available: boolean;
  // Hidden from users without it. The page itself must also be guarded.
  permission?: PermissionKey;
};

// A collapsible section. It has no page of its own; its links do.
export type NavGroup = {
  title: string;
  icon: LucideIcon;
  children: NavLink[];
};

export type NavItem = NavLink | NavGroup;

export function isNavGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

export const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, available: true, permission: "dashboard.overview.view" },
  {
    title: "Catalog",
    icon: Store,
    children: [
      { title: "Products", href: "/products", icon: Package, available: true, permission: "products.product.view" },
      { title: "Categories", href: "/categories", icon: Tags, available: true, permission: "catalog.category.view" },
      { title: "Brands", href: "/brands", icon: Award, available: true, permission: "catalog.brand.view" },
      { title: "Units", href: "/units", icon: Ruler, available: true, permission: "catalog.unit.view" },
      { title: "Suppliers", href: "/suppliers", icon: Truck, available: false },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    children: [
      { title: "Stock overview", href: "/inventory", icon: PackageSearch, available: true, permission: "inventory.stock.view" },
      { title: "Stock in", href: "/inventory/receive", icon: ArrowDownToLine, available: true, permission: "inventory.movement.receive" },
      { title: "Stock out", href: "/inventory/issue", icon: ArrowUpFromLine, available: true, permission: "inventory.movement.issue" },
      { title: "Adjustments", href: "/inventory/adjustments", icon: SlidersHorizontal, available: true, permission: "inventory.stock.view" },
      { title: "Movements", href: "/inventory/movements", icon: History, available: true, permission: "inventory.stock.view" },
      { title: "Transfers", href: "/inventory/transfers", icon: ArrowLeftRight, available: true, permission: "inventory.transfer.view" },
      { title: "Stock counts", href: "/inventory/counts", icon: ClipboardCheck, available: true, permission: "inventory.count.perform" },
      { title: "Valuation", href: "/inventory/valuation", icon: Calculator, available: false, permission: "inventory.valuation.view" },
      { title: "Warehouses", href: "/warehouses", icon: Warehouse, available: true, permission: "inventory.warehouse.view" },
    ],
  },
  {
    title: "Approvals",
    icon: CheckSquare,
    children: [
      { title: "Inbox", href: "/approvals", icon: Inbox, available: true },
      { title: "Rules", href: "/approvals/rules", icon: ListChecks, available: true, permission: "approvals.rule.view" },
      { title: "Notifications", href: "/approvals/notifications", icon: BellRing, available: true, permission: "approvals.notification.view" },
    ],
  },
  { title: "Orders", href: "/orders", icon: ShoppingCart, available: false },
  { title: "Customers", href: "/customers", icon: Users, available: false },
  { title: "Reports", href: "/reports", icon: ChartColumn, available: false },
  {
    title: "Users & access",
    icon: ShieldCheck,
    children: [
      { title: "Users", href: "/users", icon: UserCog, available: true, permission: "access.user.view" },
      { title: "Roles", href: "/roles", icon: ShieldCheck, available: true, permission: "access.role.view" },
      { title: "Audit log", href: "/audit", icon: ScrollText, available: false, permission: "access.audit.view" },
    ],
  },
  { title: "Settings", href: "/settings", icon: Settings, available: false },
];
