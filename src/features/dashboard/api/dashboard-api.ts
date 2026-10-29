import type { DashboardData, InventoryTransaction, PendingTask, StockMovementPoint } from "../types/dashboard";

// Sample data until the backend exists; replace with real requests here.
// KPIs, stock alerts and the reorder task are not here: they are derived live
// from the product store (see hooks/use-inventory-summary.ts).
const sampleMovements: StockMovementPoint[] = [
  { date: "2026-10-13", stockIn: 120, stockOut: 86 },
  { date: "2026-10-14", stockIn: 64, stockOut: 92 },
  { date: "2026-10-15", stockIn: 0, stockOut: 74 },
  { date: "2026-10-16", stockIn: 210, stockOut: 101 },
  { date: "2026-10-17", stockIn: 95, stockOut: 118 },
  { date: "2026-10-18", stockIn: 30, stockOut: 42 },
  { date: "2026-10-19", stockIn: 0, stockOut: 25 },
  { date: "2026-10-20", stockIn: 160, stockOut: 97 },
  { date: "2026-10-21", stockIn: 75, stockOut: 133 },
  { date: "2026-10-22", stockIn: 140, stockOut: 88 },
  { date: "2026-10-23", stockIn: 48, stockOut: 120 },
  { date: "2026-10-24", stockIn: 185, stockOut: 104 },
  { date: "2026-10-25", stockIn: 20, stockOut: 38 },
  { date: "2026-10-26", stockIn: 90, stockOut: 61 },
];

const sampleTransactions: InventoryTransaction[] = [
  { id: "t1", date: "2026-10-26T15:42:00", type: "stock-out", productName: "Wireless Mouse", sku: "ELC-1001", quantity: -12, reference: "SO-2231" },
  { id: "t2", date: "2026-10-26T13:10:00", type: "stock-in", productName: "A4 Copy Paper (500)", sku: "OFF-2001", quantity: 200, reference: "PO-1044" },
  { id: "t3", date: "2026-10-26T10:05:00", type: "adjustment", productName: "Stapler", sku: "OFF-2003", quantity: -3, reference: "Cycle count" },
  { id: "t4", date: "2026-10-25T16:30:00", type: "stock-out", productName: "Ergonomic Chair", sku: "FUR-3001", quantity: -2, reference: "SO-2228" },
  { id: "t5", date: "2026-10-25T09:15:00", type: "stock-in", productName: "Packing Tape", sku: "PKG-4003", quantity: 120, reference: "PO-1043" },
  { id: "t6", date: "2026-10-24T14:48:00", type: "stock-out", productName: "Mechanical Keyboard", sku: "ELC-1002", quantity: -6, reference: "SO-2224" },
  { id: "t7", date: "2026-10-24T11:20:00", type: "stock-in", productName: "Disinfectant Wipes", sku: "CLN-5001", quantity: 60, reference: "PO-1042" },
];

const sampleTasks: PendingTask[] = [
  { id: "k1", title: "Approve purchase order PO-1045", detail: "Acme Office Supply · $1,284.00", due: "2026-10-27", priority: "high" },
  { id: "k2", title: "Receive shipment from Northwind", detail: "3 pallets · Electronics", due: "2026-10-28", priority: "normal" },
  { id: "k3", title: "Cycle count: Office Supplies", detail: "5 products", due: "2026-10-30", priority: "normal" },
];

export async function getDashboardData(): Promise<DashboardData> {
  return { movements: sampleMovements, transactions: sampleTransactions, tasks: sampleTasks };
}
