import { rolesStore, usersStore } from "@/features/access-control/api/access-api";
import { registerApprovalHandler } from "@/features/approvals/api/approval-handlers";
import {
  ApprovalError,
  assertEvidence,
  cancelRequest,
  decide,
  decisionBlocker as approvalBlocker,
  requestForSubject,
  resubmit,
  submitForApproval,
} from "@/features/approvals/api/approvals-api";
import type { ApprovalEvidence, ApprovalFacts } from "@/features/approvals/types/approval";
import { variantsStore } from "@/features/product-variants/api/variants-api";
import { effectivePrices } from "@/features/product-variants/utils/variant-utils";
import { productsStore } from "@/features/products/api/products-api";
import { appendMovements, movementsStore, newGroupId, StockError } from "@/features/stock/api/ledger-store";
import { IN_TRANSIT, type StockMovement } from "@/features/stock/types/stock";
import { binLevel, computeBinLevels, computeLevels, levelAt } from "@/features/stock/utils/stock-math";
import { locationsStore, placementProblem } from "@/features/warehouses/api/locations-api";
import { warehousesStore } from "@/features/warehouses/api/warehouses-api";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import type { PermissionKey } from "@/config/permissions";
import { can } from "@/lib/authorization";
import { createStore } from "@/lib/create-store";
import { emitEvent } from "@/lib/events";
import type { User } from "@/types/access";

import { inTransit, type Transfer, type TransferEvent, type TransferLine } from "../types/transfer";

// Transfers held in memory until the backend exists. Each action checks the
// actor and the transfer's status here, as a backend would; approval runs
// through the approval engine (rules decide the levels), and stock only moves
// through the ledger, whose guard keeps every balance (including each
// transfer's goods in transit) from going negative.

export { StockError as TransferError };

export const transfersStore = createStore<Transfer[]>([
  {
    id: "trf-1",
    number: "TRF-0001",
    sourceWarehouseId: "wh-main",
    destinationWarehouseId: "wh-east",
    assigneeId: "u-10",
    note: "Rebalance for the East depot weekend sale",
    status: "pending",
    lines: [
      { id: "trl-1", productId: "prd-0001", variantId: "var-prd-0001-0", sourceLocationId: null, requested: 20, dispatched: 0, received: 0, damaged: 0, short: 0 },
      { id: "trl-2", productId: "prd-0005", variantId: "var-prd-0005-0", sourceLocationId: null, requested: 5, dispatched: 0, received: 0, damaged: 0, short: 0 },
    ],
    createdBy: "u-03",
    createdAt: "2026-10-26T15:00:00Z",
    events: [
      { at: "2026-10-26T15:00:00Z", actorId: "u-03", action: "created", detail: "2 lines, 25 units" },
      { at: "2026-10-26T15:00:00Z", actorId: "u-03", action: "submitted", detail: "" },
    ],
  },
]);

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// ---- who may do what ------------------------------------------------------------

export type TransferAction = "edit" | "submit" | "approve" | "reject" | "return" | "cancel" | "dispatch" | "receive";

const actorOf = (actorId: string) => usersStore.getState().find((user) => user.id === actorId);
const allows = (actor: User | undefined, permission: PermissionKey, record: { warehouseId: string; assignedTo?: string }) =>
  !!actor && can(actor, rolesStore.getState(), permission, record);

// Visible to anyone who may view transfers at either end, and always to the
// person it's assigned to (they have to carry it out, wherever it is).
export function canViewTransfer(actorId: string, transfer: Transfer) {
  const actor = actorOf(actorId);
  return (
    allows(actor, "inventory.transfer.view", { warehouseId: transfer.sourceWarehouseId }) ||
    allows(actor, "inventory.transfer.view", { warehouseId: transfer.destinationWarehouseId }) ||
    (transfer.assigneeId === actorId && !!actor && can(actor, rolesStore.getState(), "inventory.transfer.view"))
  );
}

export const approvalFor = (transfer: Pick<Transfer, "id">) => requestForSubject("transfer", transfer.id);

// Why `action` isn't possible for this actor right now, or null if it is.
export function actionBlocker(actorId: string, transfer: Transfer, action: TransferAction): string | null {
  const actor = actorOf(actorId);
  const execute = (warehouseId: string) =>
    allows(actor, "inventory.transfer.execute", { warehouseId, assignedTo: transfer.assigneeId ?? undefined });
  switch (action) {
    case "edit":
    case "submit":
      if (transfer.status !== "draft") return action === "edit" ? "Only drafts can be changed." : "Only drafts can be submitted.";
      return transfer.createdBy === actorId ? null : `Only the person who created it can ${action === "edit" ? "change" : "submit"} it.`;
    case "approve":
    case "reject":
    case "return": {
      if (transfer.status !== "pending") return "It isn't waiting for approval.";
      // Who decides comes from the approval rules (levels, separation of duties).
      const approval = approvalFor(transfer);
      return approval ? approvalBlocker(actorId, approval) : "Its approval request is missing.";
    }
    case "cancel":
      if (!["draft", "pending", "approved"].includes(transfer.status)) return "It can only be cancelled before dispatch.";
      return transfer.createdBy === actorId || allows(actor, "inventory.transfer.approve", { warehouseId: transfer.sourceWarehouseId })
        ? null
        : "Only the creator or an approver can cancel it.";
    case "dispatch":
      if (transfer.status !== "approved") return "It must be approved before dispatch.";
      // Dispatch waits for every approval level, whatever the status says.
      if (approvalFor(transfer)?.status !== "approved") return "Its approvals aren't complete.";
      return execute(transfer.sourceWarehouseId) ? null : "You can't dispatch from this warehouse.";
    case "receive":
      if (transfer.status !== "in-transit" && transfer.status !== "partially-received") return "Nothing is waiting to be received.";
      return execute(transfer.destinationWarehouseId) ? null : "You can't receive into this warehouse.";
  }
}

function assertAllowed(actorId: string, transfer: Transfer, action: TransferAction) {
  const blocker = actionBlocker(actorId, transfer, action);
  if (blocker) throw new StockError(blocker);
}

// ---- helpers ----------------------------------------------------------------------

function activeWarehouse(id: string): Warehouse {
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === id);
  if (!warehouse || warehouse.status !== "active") throw new StockError("Choose active warehouses.");
  return warehouse;
}

function sourceAvailable(warehouse: Warehouse, variantId: string, locationId: string | null) {
  const movements = movementsStore.getState();
  return locationId ? binLevel(computeBinLevels(movements), locationId, variantId).available : levelAt(computeLevels(movements), variantId, warehouse.id).available;
}

function assertSourceStock(transfer: Pick<Transfer, "sourceWarehouseId" | "lines">, quantityOf: (line: TransferLine) => number) {
  const source = activeWarehouse(transfer.sourceWarehouseId);
  for (const line of transfer.lines) {
    const quantity = quantityOf(line);
    if (quantity === 0) continue;
    const available = sourceAvailable(source, line.variantId, line.sourceLocationId);
    const sku = variantsStore.getState().find((variant) => variant.id === line.variantId)?.sku ?? "an item";
    if (quantity > available) throw new StockError(`Only ${available} of ${sku} available at the source.`);
  }
}

function update(transferId: string, change: (transfer: Transfer) => Transfer) {
  transfersStore.setState((list) => list.map((transfer) => (transfer.id === transferId ? change(transfer) : transfer)));
}

const event = (actorId: string, action: TransferEvent["action"], detail = ""): TransferEvent => ({
  at: new Date().toISOString(),
  actorId,
  action,
  detail,
});

function find(transferId: string) {
  const transfer = transfersStore.getState().find((candidate) => candidate.id === transferId);
  if (!transfer) throw new StockError("Transfer not found.");
  return transfer;
}

// Engine errors surface as transfer errors to callers.
function engine<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof ApprovalError) throw new StockError(error.message);
    throw error;
  }
}

// ---- approval facts --------------------------------------------------------------

const unitCost = (variantId: string) => {
  const variant = variantsStore.getState().find((candidate) => candidate.id === variantId);
  const product = variant && productsStore.getState().find((candidate) => candidate.id === variant.productId);
  return variant && product ? effectivePrices(variant, product).costPrice : 0;
};

// What approval rules match a transfer on: route, units, value at cost, bin move.
export function transferFacts(transfer: { sourceWarehouseId: string; destinationWarehouseId: string; lines: { variantId: string; requested: number }[] }): ApprovalFacts {
  return {
    warehouseId: transfer.sourceWarehouseId,
    destinationWarehouseId: transfer.destinationWarehouseId,
    quantity: transfer.lines.reduce((sum, line) => sum + line.requested, 0),
    value: transfer.lines.reduce((sum, line) => sum + line.requested * unitCost(line.variantId), 0),
    binMove: transfer.sourceWarehouseId === transfer.destinationWarehouseId,
  };
}

const warehouseName = (id: string) => warehousesStore.getState().find((warehouse) => warehouse.id === id)?.name ?? id;

function transferSummary(transfer: Transfer) {
  const units = transfer.lines.reduce((sum, line) => sum + line.requested, 0);
  const route = transfer.sourceWarehouseId === transfer.destinationWarehouseId ? `${warehouseName(transfer.sourceWarehouseId)}, bin to bin` : `${warehouseName(transfer.sourceWarehouseId)} → ${warehouseName(transfer.destinationWarehouseId)}`;
  return `${route}: ${units} units, ${transfer.lines.length} ${transfer.lines.length === 1 ? "item" : "items"}`;
}

const transferEvidence = (transfer: Transfer): ApprovalEvidence => ({
  note: transfer.note,
  details: [
    { label: "Items", value: String(transfer.lines.length) },
    { label: "Units", value: String(transfer.lines.reduce((sum, line) => sum + line.requested, 0)) },
  ],
  documents: [],
});

// Moves a draft to pending approval: opens (or, after a return, reopens) its
// approval request. A bypass rule approves it at once.
function sendForApproval(actorId: string, transfer: Transfer) {
  const facts = transferFacts(transfer);
  engine(() => assertEvidence("transfer", facts, { note: transfer.note, documents: [] }));
  assertSourceStock(transfer, (line) => line.requested);
  update(transfer.id, (current) => ({ ...current, status: "pending", events: [...current.events, event(actorId, "submitted")] }));
  const pending = find(transfer.id);
  const previous = approvalFor(transfer);
  engine(() =>
    previous?.status === "returned"
      ? resubmit(actorId, previous.id, facts, transferSummary(pending), transferEvidence(pending))
      : submitForApproval({
          kind: "transfer",
          subjectId: transfer.id,
          reference: transfer.number,
          summary: transferSummary(pending),
          href: `/inventory/transfers/${transfer.id}`,
          facts,
          evidence: transferEvidence(pending),
          requestedBy: actorId,
        }),
  );
}

// ---- create, edit, submit, cancel ----------------------------------------------------

export type NewTransferInput = {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  assigneeId: string | null;
  note: string;
  lines: { variantId: string; quantity: number; sourceLocationId: string | null }[];
};

// Validates a transfer's route and lines (shared by create and edit).
function buildTransfer(actorId: string, input: NewTransferInput, keepIds: Map<string, string> = new Map()) {
  const actor = actorOf(actorId);
  if (!allows(actor, "inventory.transfer.create", { warehouseId: input.sourceWarehouseId })) throw new StockError("You can't create transfers from this warehouse.");
  const source = activeWarehouse(input.sourceWarehouseId);
  activeWarehouse(input.destinationWarehouseId);
  if (source.id === input.destinationWarehouseId && !source.trackBins) {
    throw new StockError("Choose a different destination. Moves inside one warehouse need bin tracking.");
  }
  if (input.assigneeId && !usersStore.getState().some((user) => user.id === input.assigneeId && user.status === "active")) {
    throw new StockError("Assign it to an active user.");
  }
  if (input.lines.length === 0) throw new StockError("Add at least one item.");

  const seen = new Set<string>();
  const lines: TransferLine[] = input.lines.map((line) => {
    const variant = variantsStore.getState().find((candidate) => candidate.id === line.variantId);
    const product = variant && productsStore.getState().find((candidate) => candidate.id === variant.productId);
    if (!variant || !product || variant.status !== "active" || product.status === "archived") throw new StockError("An item isn't active.");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new StockError(`Quantity for ${variant.sku} must be a whole number above 0.`);
    if (source.trackBins) {
      const bin = locationsStore.getState().find((location) => location.id === line.sourceLocationId);
      if (!bin || bin.warehouseId !== source.id || bin.type !== "bin") throw new StockError(`Choose the bin to pick ${variant.sku} from.`);
    } else if (line.sourceLocationId) {
      throw new StockError(`${source.name} doesn't track bins.`);
    }
    const key = `${variant.id}|${line.sourceLocationId ?? ""}`;
    if (seen.has(key)) throw new StockError(`${variant.sku} is listed twice.`);
    seen.add(key);
    return { id: keepIds.get(key) ?? randomId("trl"), productId: product.id, variantId: variant.id, sourceLocationId: line.sourceLocationId, requested: line.quantity, dispatched: 0, received: 0, damaged: 0, short: 0 };
  });
  assertSourceStock({ sourceWarehouseId: source.id, lines }, (line) => line.requested);
  return { source, lines };
}

export async function createTransfer(actorId: string, input: NewTransferInput, submit: boolean): Promise<Transfer> {
  const { source, lines } = buildTransfer(actorId, input);
  const numbers = transfersStore.getState().map((transfer) => Number(transfer.number.slice(4)) || 0);
  const units = lines.reduce((sum, line) => sum + line.requested, 0);
  const transfer: Transfer = {
    id: randomId("trf"),
    number: `TRF-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`,
    sourceWarehouseId: source.id,
    destinationWarehouseId: input.destinationWarehouseId,
    assigneeId: input.assigneeId,
    note: input.note.trim(),
    status: "draft",
    lines,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
    events: [event(actorId, "created", `${lines.length} lines, ${units} units`)],
  };
  // Check the rule's evidence before anything is stored, so a refused submit leaves nothing behind.
  if (submit) engine(() => assertEvidence("transfer", transferFacts(transfer), { note: transfer.note, documents: [] }));
  transfersStore.setState((list) => [...list, transfer]);
  if (submit) sendForApproval(actorId, transfer);
  return find(transfer.id);
}

const sku = (variantId: string) => variantsStore.getState().find((variant) => variant.id === variantId)?.sku ?? "item";

// What changed in a draft, in words, for the history.
function describeChanges(before: Transfer, after: Pick<Transfer, "sourceWarehouseId" | "destinationWarehouseId" | "assigneeId" | "note" | "lines">) {
  const users = usersStore.getState();
  const nameOf = (id: string | null) => users.find((user) => user.id === id)?.name ?? "nobody";
  const keyOf = (line: TransferLine) => `${line.variantId}|${line.sourceLocationId ?? ""}`;
  const was = new Map(before.lines.map((line) => [keyOf(line), line]));
  const now = new Map(after.lines.map((line) => [keyOf(line), line]));
  const parts: string[] = [];
  if (before.sourceWarehouseId !== after.sourceWarehouseId || before.destinationWarehouseId !== after.destinationWarehouseId) {
    parts.push(`route ${warehouseName(after.sourceWarehouseId)} → ${warehouseName(after.destinationWarehouseId)}`);
  }
  for (const [key, line] of now) {
    const old = was.get(key);
    if (!old) parts.push(`added ${sku(line.variantId)} × ${line.requested}`);
    else if (old.requested !== line.requested) parts.push(`${sku(line.variantId)} ${old.requested} → ${line.requested}`);
  }
  for (const [key, line] of was) if (!now.has(key)) parts.push(`removed ${sku(line.variantId)}`);
  if (before.assigneeId !== after.assigneeId) parts.push(`assigned to ${nameOf(after.assigneeId)}`);
  if (before.note !== after.note) parts.push("note changed");
  return parts.join("; ");
}

// The creator changes a draft (also after it was returned for correction). Every change is recorded.
export async function updateTransfer(actorId: string, transferId: string, input: NewTransferInput): Promise<void> {
  const before = find(transferId);
  assertAllowed(actorId, before, "edit");
  const keepIds = new Map(before.lines.map((line) => [`${line.variantId}|${line.sourceLocationId ?? ""}`, line.id]));
  const { source, lines } = buildTransfer(actorId, input, keepIds);
  const next = { sourceWarehouseId: source.id, destinationWarehouseId: input.destinationWarehouseId, assigneeId: input.assigneeId, note: input.note.trim(), lines };
  const detail = describeChanges(before, next);
  if (!detail) return;
  update(transferId, (current) => ({ ...current, ...next, events: [...current.events, event(actorId, "changed", detail)] }));
}

export async function submitTransfer(actorId: string, transferId: string): Promise<void> {
  const transfer = find(transferId);
  assertAllowed(actorId, transfer, "submit");
  sendForApproval(actorId, transfer);
}

// One decision on the current approval level. The transfer page offers the
// full set (approve, reject, return for correction) through the approval engine.
export async function decideTransfer(actorId: string, transferId: string, approve: boolean, reason: string): Promise<void> {
  const transfer = find(transferId);
  assertAllowed(actorId, transfer, approve ? "approve" : "reject");
  if (!approve && !reason.trim()) throw new StockError("Give a reason for rejecting it.");
  const approval = approvalFor(transfer)!;
  await decide(actorId, approval.id, { action: approve ? "approve" : "reject", comment: reason }).catch((error) => {
    throw error instanceof ApprovalError ? new StockError(error.message) : error;
  });
}

export async function cancelTransfer(actorId: string, transferId: string, reason: string): Promise<void> {
  const transfer = find(transferId);
  assertAllowed(actorId, transfer, "cancel");
  const approval = approvalFor(transfer);
  if (approval && (approval.status === "pending" || approval.status === "returned")) cancelRequest(actorId, approval.id, reason);
  update(transferId, (current) => ({ ...current, status: "cancelled", events: [...current.events, event(actorId, "cancelled", reason.trim())] }));
  emitEvent("stock.transferChanged", { actorId, summary: `Cancelled ${transfer.number}${reason.trim() ? `: ${reason.trim()}` : ""}` });
}

// The approval engine decides; these apply its decisions to transfers.
registerApprovalHandler("transfer", {
  approved: (transferId, actorId, automatic) => {
    const transfer = find(transferId);
    if (transfer.status !== "pending") throw new StockError("It isn't waiting for approval.");
    // Stock may have moved since it was requested.
    assertSourceStock(transfer, (line) => line.requested);
    update(transferId, (current) => ({
      ...current,
      status: "approved",
      events: [...current.events, event(actorId, "approved", automatic ? `No approval needed (${automatic.ruleName})` : "")],
    }));
    emitEvent("stock.transferChanged", { actorId, summary: automatic ? `${transfer.number} needed no approval (${automatic.ruleName})` : `Approved ${transfer.number}` });
  },
  rejected: (transferId, actorId, comment) => {
    update(transferId, (current) => ({ ...current, status: "rejected", events: [...current.events, event(actorId, "rejected", comment)] }));
    emitEvent("stock.transferChanged", { actorId, summary: `Rejected ${find(transferId).number}: ${comment}` });
  },
  returned: (transferId, actorId, comment) => {
    update(transferId, (current) => ({ ...current, status: "draft", events: [...current.events, event(actorId, "returned", comment)] }));
  },
});

// ---- dispatch and receive --------------------------------------------------------------

// quantities: lineId -> units actually sent (may be less than requested).
export async function dispatchTransfer(actorId: string, transferId: string, quantities: Record<string, number>): Promise<void> {
  const transfer = find(transferId);
  assertAllowed(actorId, transfer, "dispatch");
  const sent = (line: TransferLine) => quantities[line.id] ?? 0;
  for (const line of transfer.lines) {
    const quantity = sent(line);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > line.requested) throw new StockError("Dispatch between 0 and the requested quantity on each line.");
  }
  if (transfer.lines.every((line) => sent(line) === 0)) throw new StockError("Dispatch at least one item.");
  // Re-checked at the moment stock leaves.
  assertSourceStock(transfer, sent);

  const at = new Date().toISOString();
  const lines: Omit<StockMovement, "id" | "groupId">[] = transfer.lines.flatMap((line) => {
    const quantity = sent(line);
    if (quantity === 0) return [];
    const common = { at, productId: line.productId, variantId: line.variantId, bucket: "available" as const, unitCost: null, reference: transfer.number, actorId };
    return [
      { ...common, type: "transfer-out" as const, warehouseId: transfer.sourceWarehouseId, locationId: line.sourceLocationId, quantity: -quantity, reason: "Dispatched" },
      { ...common, type: "transfer-out" as const, warehouseId: IN_TRANSIT, locationId: transfer.id, quantity, reason: "In transit" },
    ];
  });
  appendMovements(newGroupId(), lines);
  const units = transfer.lines.reduce((sum, line) => sum + sent(line), 0);
  const shortAtSource = transfer.lines.reduce((sum, line) => sum + line.requested - sent(line), 0);
  update(transferId, (current) => ({
    ...current,
    status: "in-transit",
    lines: current.lines.map((line) => ({ ...line, dispatched: sent(line) })),
    events: [...current.events, event(actorId, "dispatched", `${units} units${shortAtSource > 0 ? `, ${shortAtSource} fewer than requested` : ""}`)],
  }));
}

export type LineReceipt = { received: number; damaged: number; short: number; locationId: string | null };

// receipts: lineId -> what was counted on arrival. Several partial receipts are fine.
export async function receiveTransfer(actorId: string, transferId: string, receipts: Record<string, LineReceipt>): Promise<void> {
  const transfer = find(transferId);
  assertAllowed(actorId, transfer, "receive");
  const destination = activeWarehouse(transfer.destinationWarehouseId);
  const products = productsStore.getState();

  const counted = transfer.lines.map((line) => {
    const receipt = receipts[line.id] ?? { received: 0, damaged: 0, short: 0, locationId: null };
    const parts = [receipt.received, receipt.damaged, receipt.short];
    if (parts.some((part) => !Number.isInteger(part) || part < 0)) throw new StockError("Use whole numbers of 0 or more.");
    const total = parts.reduce((sum, part) => sum + part, 0);
    if (total > inTransit(line)) throw new StockError(`Only ${inTransit(line)} of a line are still in transit.`);
    const arriving = receipt.received + receipt.damaged;
    if (arriving > 0 && destination.id === transfer.sourceWarehouseId && receipt.locationId === line.sourceLocationId) {
      throw new StockError("Put it in a different bin from the one it came from.");
    }
    return { line, receipt, total, arriving };
  });
  if (counted.every(({ total }) => total === 0)) throw new StockError("Record at least one received, damaged or short unit.");

  // Destination bins: same rules as stock in (active, category, capacity), per bin.
  const byBin = new Map<string | null, { categoryId: string; units: number }[]>();
  for (const { line, receipt, arriving } of counted) {
    if (arriving === 0) continue;
    const categoryId = products.find((product) => product.id === line.productId)?.categoryId ?? "";
    byBin.set(receipt.locationId, [...(byBin.get(receipt.locationId) ?? []), { categoryId, units: arriving }]);
  }
  for (const [locationId, items] of byBin) {
    const problem = placementProblem(destination.id, locationId, items);
    if (problem) throw new StockError(problem);
  }

  const at = new Date().toISOString();
  const movements: Omit<StockMovement, "id" | "groupId">[] = counted.flatMap(({ line, receipt, total }) => {
    if (total === 0) return [];
    const common = { at, productId: line.productId, variantId: line.variantId, unitCost: null, reference: transfer.number, actorId };
    const out: Omit<StockMovement, "id" | "groupId">[] = [
      { ...common, type: "transfer-in", warehouseId: IN_TRANSIT, locationId: transfer.id, bucket: "available", quantity: -(receipt.received + receipt.damaged), reason: "Arrived" },
    ];
    if (receipt.received > 0) out.push({ ...common, type: "transfer-in", warehouseId: destination.id, locationId: receipt.locationId, bucket: "available", quantity: receipt.received, reason: "Received" });
    if (receipt.damaged > 0) out.push({ ...common, type: "transfer-in", warehouseId: destination.id, locationId: receipt.locationId, bucket: "damaged", quantity: receipt.damaged, reason: "Arrived damaged" });
    if (receipt.short > 0) out.push({ ...common, type: "transfer-loss", warehouseId: IN_TRANSIT, locationId: transfer.id, bucket: "available", quantity: -receipt.short, reason: "Short on receipt" });
    return out.filter((movement) => movement.quantity !== 0);
  });
  appendMovements(newGroupId(), movements);

  const nextLines = transfer.lines.map((line) => {
    const receipt = receipts[line.id];
    return receipt ? { ...line, received: line.received + receipt.received, damaged: line.damaged + receipt.damaged, short: line.short + receipt.short } : line;
  });
  const done = nextLines.every((line) => inTransit(line) === 0);
  const sum = (key: keyof LineReceipt) => counted.reduce((total, { receipt }) => total + (receipt[key] as number), 0);
  const detail = [`${sum("received")} received`, sum("damaged") > 0 && `${sum("damaged")} damaged`, sum("short") > 0 && `${sum("short")} short`].filter(Boolean).join(", ");
  update(transferId, (current) => ({
    ...current,
    status: done ? "completed" : "partially-received",
    lines: nextLines,
    events: [...current.events, event(actorId, "received", detail)],
  }));
}
