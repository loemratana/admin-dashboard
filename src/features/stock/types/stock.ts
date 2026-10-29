import type { SupportingDocument } from "@/features/approvals/types/approval";

// Where a unit sits within a warehouse. On hand = available + reserved + damaged + quarantined.
// Only available stock can be issued; quarantined stock is on hold for inspection.
export type StockBucket = "available" | "reserved" | "damaged" | "quarantined";

export type MovementType =
  | "opening" // opening balance when stock is first recorded
  | "receipt" // stock in
  | "issue" // stock out
  | "adjustment" // approved adjustment
  | "reservation" // held for an order (available -> reserved)
  | "variant-change" // stock moved between variants when a product's variants change
  | "transfer-out" // dispatched: source -> in transit
  | "transfer-in" // received: in transit -> destination
  | "transfer-loss" // reported short on receipt: in transit -> gone
  | "count"; // posted stock count variance

// One line of the ledger. The ledger is append-only: stock levels, history and
// (later) valuation are all calculated from these entries.
export type StockMovement = {
  id: string;
  groupId: string; // lines posted together (one receipt, one adjustment) share it
  at: string; // ISO date-time
  type: MovementType;
  productId: string;
  variantId: string;
  warehouseId: string;
  // The bin, in warehouses that track bins; null otherwise.
  locationId: string | null;
  bucket: StockBucket;
  quantity: number; // signed: + into the bucket, - out of it
  unitCost: number | null; // known for stock coming in
  reference: string; // e.g. PO-1044, SO-2231, ADJ-0003
  reason: string;
  actorId: string;
};

export type StockLevel = Record<StockBucket, number>;

// Dispatched transfers sit here until received; locationId is the transfer's id,
// so each transfer's goods in transit are balanced (and guarded) separately.
export const IN_TRANSIT = "in-transit";

export type AdjustmentReason =
  | "damaged"
  | "lost"
  | "found"
  | "write-off-damaged"
  | "correction-increase"
  | "correction-decrease"
  | "quarantine"
  | "release-quarantine"
  | "write-off-quarantined";

export type AdjustmentStatus = "pending" | "approved" | "rejected" | "returned";

export type AdjustmentRequest = {
  id: string;
  number: string; // ADJ-0001
  warehouseId: string;
  locationId: string | null; // the bin, in bin-tracked warehouses
  productId: string;
  variantId: string;
  reason: AdjustmentReason;
  quantity: number; // always positive; the reason decides the direction
  systemQuantity: number; // the balance it applies to (see systemBucket) when requested
  countedQuantity: number | null; // what was counted, for count-based corrections
  variance: number; // signed change to that balance
  note: string;
  documents: SupportingDocument[];
  status: AdjustmentStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string;
};
