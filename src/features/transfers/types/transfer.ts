export type TransferStatus =
  | "draft"
  | "pending" // pending approval
  | "approved"
  | "in-transit"
  | "partially-received"
  | "completed"
  | "rejected"
  | "cancelled";

export type TransferLine = {
  id: string;
  productId: string;
  variantId: string;
  sourceLocationId: string | null; // bin to pick from, in bin-tracked sources
  requested: number;
  dispatched: number; // may be less than requested if the source was short
  received: number; // arrived in good condition
  damaged: number; // arrived damaged
  short: number; // never arrived: written off as lost in transit
};

// Every step, who did it and when: the transfer's audit trail.
export type TransferEvent = {
  at: string;
  actorId: string;
  action: "created" | "changed" | "submitted" | "approved" | "rejected" | "returned" | "cancelled" | "dispatched" | "received";
  detail: string;
};

export type Transfer = {
  id: string;
  number: string; // TRF-0001
  sourceWarehouseId: string;
  destinationWarehouseId: string; // the same warehouse for a bin-to-bin move
  assigneeId: string | null; // who carries it out (needed for "assigned" scoped staff)
  note: string;
  status: TransferStatus;
  lines: TransferLine[];
  createdBy: string;
  createdAt: string;
  events: TransferEvent[];
};

// Still on the road for a line.
export const inTransit = (line: TransferLine) => line.dispatched - line.received - line.damaged - line.short;
