export type InventoryKpis = {
  stockValue: number;
  productCount: number;
  categoryCount: number;
  unitsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export type StockMovementPoint = {
  date: string; // ISO date, e.g. "2026-10-26"
  stockIn: number;
  stockOut: number;
};

export type TransactionType = "stock-in" | "stock-out" | "adjustment";

export type InventoryTransaction = {
  id: string;
  date: string; // ISO date-time
  type: TransactionType;
  productName: string;
  sku: string;
  quantity: number; // signed: positive adds stock, negative removes it
  reference: string;
};

export type PendingTask = {
  id: string;
  title: string;
  detail: string;
  due?: string; // ISO date
  priority: "high" | "normal";
  href?: string;
};

export type DashboardData = {
  movements: StockMovementPoint[];
  transactions: InventoryTransaction[];
  tasks: PendingTask[];
};
