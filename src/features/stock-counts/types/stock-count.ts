export type CountStatus =
  | "counting" // counters are entering quantities
  | "review" // submitted: an approver checks the variances
  | "posted" // variances posted to the ledger
  | "cancelled";

// One thing to count: an item in the warehouse, or an item in a bin for
// warehouses that track bins. A count covers good stock only (available +
// reserved); damaged and quarantined units are kept apart and not counted here.
export type CountLine = {
  id: string;
  productId: string;
  variantId: string;
  locationId: string | null;
  expected: number; // the system's good stock when the line was added
  counted: number | null; // null until counted
  countedBy: string | null;
  countedAt: string | null;
  recount: boolean; // sent back by the reviewer
  added: boolean; // added during the count (found somewhere unexpected)
};

export type CountEvent = {
  at: string;
  actorId: string;
  action: "started" | "counted" | "submitted" | "recount" | "posted" | "cancelled";
  detail: string;
};

export type StockCount = {
  id: string;
  number: string; // CNT-0001
  warehouseId: string;
  categoryId: string | null; // null: every category
  blind: boolean; // counters don't see expected quantities
  note: string;
  status: CountStatus;
  lines: CountLine[];
  createdBy: string;
  createdAt: string;
  events: CountEvent[];
};

export const variance = (line: CountLine) => (line.counted === null ? 0 : line.counted - line.expected);
