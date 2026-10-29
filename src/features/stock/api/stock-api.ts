import { rolesStore, usersStore } from "@/features/access-control/api/access-api";
import { registerApprovalHandler } from "@/features/approvals/api/approval-handlers";
import { ApprovalError, assertEvidence, decide, decisionBlocker as approvalBlocker, requestForSubject, requirementsFor, resubmit, submitForApproval } from "@/features/approvals/api/approvals-api";
import type { ApprovalEvidence, DocumentUpload, SupportingDocument } from "@/features/approvals/types/approval";
import { variantsStore } from "@/features/product-variants/api/variants-api";
import { effectivePrices } from "@/features/product-variants/utils/variant-utils";
import { productsStore } from "@/features/products/api/products-api";
import { locationsStore, placementProblem } from "@/features/warehouses/api/locations-api";
import { warehousesStore } from "@/features/warehouses/api/warehouses-api";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import type { PermissionKey } from "@/config/permissions";
import { can } from "@/lib/authorization";
import { emitEvent } from "@/lib/events";

import type { AdjustmentReason, AdjustmentRequest, StockBucket } from "../types/stock";
import { adjustmentEffects, adjustmentSource, binLevel, computeBinLevels, computeLevels, levelAt } from "../utils/stock-math";
import { adjustmentsStore, appendMovements, movementsStore, newGroupId, StockError } from "./ledger-store";

// Every stock change is validated here, then posted to the ledger. The UI hides
// what you can't do; these checks are the real rules, as a backend would apply.

export { StockError };

// locationId: the bin, required in bin-tracked warehouses and not allowed elsewhere.
type Line = { variantId: string; quantity: number; locationId?: string | null };

function context(actorId: string, permission: PermissionKey, warehouseId: string) {
  const actor = usersStore.getState().find((user) => user.id === actorId);
  const roles = rolesStore.getState();
  if (!actor || !can(actor, roles, permission, { warehouseId })) {
    throw new StockError("You don't have permission for this warehouse.");
  }
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === warehouseId);
  if (!warehouse || warehouse.status !== "active") throw new StockError("Choose an active warehouse.");
  return { actor, roles, warehouse };
}

function resolveLines<L extends Line>(lines: L[]) {
  if (lines.length === 0) throw new StockError("Add at least one item.");
  const seen = new Set<string>();
  return lines.map((line) => {
    const variant = variantsStore.getState().find((candidate) => candidate.id === line.variantId);
    const product = variant && productsStore.getState().find((candidate) => candidate.id === variant.productId);
    if (!variant || !product) throw new StockError("An item no longer exists.");
    if (variant.status !== "active" || product.status === "archived") throw new StockError(`${variant.sku} isn't active.`);
    // The same item may come from two bins, but not twice from the same place.
    const key = `${variant.id}|${line.locationId ?? ""}`;
    if (seen.has(key)) throw new StockError(`${variant.sku} is listed twice.`);
    seen.add(key);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new StockError(`Quantity for ${variant.sku} must be a whole number above 0.`);
    return { ...line, locationId: line.locationId ?? null, variant, product };
  });
}

// Taking stock out of a bin: it must be a bin of this warehouse (inactive is fine,
// so a retired bin can be emptied). Warehouses without bins take no bin.
function assertSourceBin(warehouse: Warehouse, locationId: string | null) {
  if (!warehouse.trackBins) {
    if (locationId) throw new StockError(`${warehouse.name} doesn't track bins.`);
    return;
  }
  const location = locationsStore.getState().find((candidate) => candidate.id === locationId);
  if (!location || location.warehouseId !== warehouse.id || location.type !== "bin") {
    throw new StockError(`Choose a bin: ${warehouse.name} tracks stock by bin.`);
  }
}

// Putting stock into a bin: active, right category, enough room (lines into the
// same bin are checked together).
function assertPlacement(warehouse: Warehouse, lines: { locationId: string | null; quantity: number; product: { categoryId: string } }[]) {
  const byLocation = new Map<string | null, typeof lines>();
  for (const line of lines) byLocation.set(line.locationId, [...(byLocation.get(line.locationId) ?? []), line]);
  for (const [locationId, group] of byLocation) {
    const problem = placementProblem(warehouse.id, locationId, group.map((line) => ({ categoryId: line.product.categoryId, units: line.quantity })));
    if (problem) throw new StockError(problem);
  }
}

function nextNumber(prefix: string) {
  const used = movementsStore
    .getState()
    .map((movement) => movement.reference)
    .filter((reference) => reference.startsWith(`${prefix}-`))
    .map((reference) => Number(reference.slice(prefix.length + 1)) || 0);
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(4, "0")}`;
}

// ---- stock in ----------------------------------------------------------------

export type ReceiveInput = {
  warehouseId: string;
  reference: string; // supplier or PO reference, optional
  // Hold everything for inspection: it lands in quarantine instead of available.
  quarantine?: boolean;
  lines: (Line & { unitCost: number | null })[];
};

export async function receiveStock(actorId: string, input: ReceiveInput): Promise<string> {
  const { actor, roles, warehouse } = context(actorId, "inventory.movement.receive", input.warehouseId);
  const canSetCost = can(actor, roles, "products.cost.view");
  const lines = resolveLines(input.lines);
  assertPlacement(warehouse, lines);
  const number = nextNumber("RCV");
  const at = new Date().toISOString();
  appendMovements(
    newGroupId(),
    lines.map(({ variant, product, quantity, unitCost, locationId }) => {
      if (canSetCost && unitCost !== null && !(unitCost >= 0)) throw new StockError(`Cost for ${variant.sku} can't be negative.`);
      return {
        at,
        type: "receipt",
        productId: product.id,
        variantId: variant.id,
        warehouseId: warehouse.id,
        locationId,
        bucket: input.quarantine ? "quarantined" : "available",
        quantity,
        // Without cost access you can't set a cost; the standard cost is used.
        unitCost: canSetCost && unitCost !== null ? unitCost : effectivePrices(variant, product).costPrice,
        reference: number,
        reason: [input.reference.trim(), input.quarantine ? "Held for inspection" : ""].filter(Boolean).join(" · "),
        actorId,
      };
    }),
  );
  return number;
}

// ---- stock out -----------------------------------------------------------------

export const issueReasons = ["Sale", "Internal use", "Sample", "Return to supplier", "Other"] as const;

export type IssueInput = {
  warehouseId: string;
  reason: (typeof issueReasons)[number];
  reference: string;
  lines: Line[];
};

export async function issueStock(actorId: string, input: IssueInput): Promise<string> {
  const { warehouse } = context(actorId, "inventory.movement.issue", input.warehouseId);
  if (!issueReasons.includes(input.reason)) throw new StockError("Choose a reason.");
  const lines = resolveLines(input.lines);
  const levels = computeLevels(movementsStore.getState());
  const bins = computeBinLevels(movementsStore.getState());
  for (const { variant, quantity, locationId } of lines) {
    assertSourceBin(warehouse, locationId);
    const available = locationId ? binLevel(bins, locationId, variant.id).available : levelAt(levels, variant.id, warehouse.id).available;
    const where = locationId ? "that bin" : warehouse.name;
    if (quantity > available) throw new StockError(`Only ${available} of ${variant.sku} available in ${where}.`);
  }
  const number = nextNumber("ISS");
  const at = new Date().toISOString();
  appendMovements(
    newGroupId(),
    lines.map(({ variant, product, quantity, locationId }) => ({
      at,
      type: "issue",
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      locationId,
      bucket: "available",
      quantity: -quantity,
      unitCost: null,
      reference: number,
      reason: [input.reason, input.reference.trim()].filter(Boolean).join(" · "),
      actorId,
    })),
  );
  return number;
}

// ---- adjustments ---------------------------------------------------------------

export type DocumentInput = DocumentUpload;

export type AdjustmentInput = {
  warehouseId: string;
  locationId: string | null;
  variantId: string;
  reason: AdjustmentReason;
  quantity: number;
  // What was counted on the shelf, for corrections, losses and finds. When
  // given, the quantity is the difference from the system quantity.
  countedQuantity?: number | null;
  note: string;
  documents?: DocumentInput[];
};

// Reasons that can come from a count: the counted quantity sets the size.
export const countReasons: AdjustmentReason[] = ["lost", "found", "correction-increase", "correction-decrease"];

const MAX_DOCUMENTS = 5;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function assertSourceHasStock(reason: AdjustmentReason, variantId: string, warehouseId: string, locationId: string | null, quantity: number, sku: string) {
  const source = adjustmentSource(reason);
  if (!source) return;
  const held = heldIn(source, variantId, warehouseId, locationId);
  if (quantity > held) throw new StockError(`Only ${held} of ${sku} are ${source} here.`);
}

function heldIn(bucket: StockBucket, variantId: string, warehouseId: string, locationId: string | null) {
  return locationId
    ? binLevel(computeBinLevels(movementsStore.getState()), locationId, variantId)[bucket]
    : levelAt(computeLevels(movementsStore.getState()), variantId, warehouseId)[bucket];
}

// Adjustments that add stock ("found", corrections up) place it in the bin.
const addsStock = (reason: AdjustmentReason) => adjustmentSource(reason) === null;

// The balance an adjustment is measured against: the bucket it takes from, or available for additions.
export const systemBucket = (reason: AdjustmentReason): StockBucket => adjustmentSource(reason) ?? "available";

function assertAdjustmentLocation(warehouse: Warehouse, reason: AdjustmentReason, line: { locationId: string | null; quantity: number; product: { categoryId: string } }) {
  if (addsStock(reason)) assertPlacement(warehouse, [line]);
  else assertSourceBin(warehouse, line.locationId);
}

// Works out quantity and variance against the current system quantity.
function measure(reason: AdjustmentReason, systemQuantity: number, quantity: number, countedQuantity: number | null | undefined) {
  if (countedQuantity === null || countedQuantity === undefined) {
    return { quantity, countedQuantity: null, variance: addsStock(reason) ? quantity : -quantity };
  }
  if (!countReasons.includes(reason)) throw new StockError("A counted quantity only applies to corrections, losses and finds.");
  if (!Number.isInteger(countedQuantity) || countedQuantity < 0) throw new StockError("The counted quantity must be a whole number of 0 or more.");
  const variance = countedQuantity - systemQuantity;
  if (variance === 0) throw new StockError("The count matches the system: there's nothing to adjust.");
  if (addsStock(reason) && variance < 0) throw new StockError(`The count is ${-variance} below the system. Use Lost or missing, or Correction (decrease).`);
  if (!addsStock(reason) && variance > 0) throw new StockError(`The count is ${variance} above the system. Use Found, or Correction (increase).`);
  return { quantity: Math.abs(variance), countedQuantity, variance };
}

function attach(actorId: string, documents: (DocumentInput | SupportingDocument)[]): SupportingDocument[] {
  if (documents.length > MAX_DOCUMENTS) throw new StockError(`Attach at most ${MAX_DOCUMENTS} documents.`);
  const at = new Date().toISOString();
  return documents.map((document) => {
    if ("id" in document) return document;
    if (!document.name.trim() || !document.url) throw new StockError("A document is missing its file.");
    if (!(document.type.startsWith("image/") || document.type === "application/pdf")) throw new StockError(`${document.name}: attach images or PDFs.`);
    if (document.size > MAX_DOCUMENT_BYTES) throw new StockError(`${document.name} is over 10 MB.`);
    return { ...document, name: document.name.trim(), id: `doc-${Math.random().toString(36).slice(2, 10)}`, uploadedBy: actorId, uploadedAt: at };
  });
}

function adjustmentEvidence(request: AdjustmentRequest): ApprovalEvidence {
  const bucket = systemBucket(request.reason);
  return {
    note: request.note,
    details: [
      { label: `System quantity (${bucket})`, value: String(request.systemQuantity) },
      ...(request.countedQuantity !== null ? [{ label: "Counted", value: String(request.countedQuantity) }] : []),
      { label: "Variance", value: request.variance > 0 ? `+${request.variance}` : String(request.variance) },
    ],
    documents: request.documents,
  };
}

// The engine's evidence errors, in this module's error type.
function checkEvidence(facts: ReturnType<typeof adjustmentFacts>, evidence: Pick<ApprovalEvidence, "note" | "documents">) {
  try {
    assertEvidence("adjustment", facts, evidence);
  } catch (error) {
    if (error instanceof ApprovalError) throw new StockError(error.message);
    throw error;
  }
}

export async function requestAdjustment(actorId: string, input: AdjustmentInput): Promise<AdjustmentRequest> {
  const { warehouse } = context(actorId, "inventory.adjustment.request", input.warehouseId);
  if (!adjustmentEffects[input.reason]) throw new StockError("Choose a reason.");
  const systemQuantity = heldIn(systemBucket(input.reason), input.variantId, input.warehouseId, input.locationId);
  const measured = measure(input.reason, systemQuantity, input.quantity, input.countedQuantity);
  const [line] = resolveLines([{ variantId: input.variantId, quantity: measured.quantity, locationId: input.locationId }]);
  if (!input.note.trim()) throw new StockError("Explain what happened.");
  assertAdjustmentLocation(warehouse, input.reason, line);
  assertSourceHasStock(input.reason, line.variant.id, input.warehouseId, line.locationId, measured.quantity, line.variant.sku);
  const documents = attach(actorId, input.documents ?? []);

  const numbers = adjustmentsStore.getState().map((request) => Number(request.number.slice(4)) || 0);
  const request: AdjustmentRequest = {
    id: `adj-${Math.random().toString(36).slice(2, 8)}`,
    number: `ADJ-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`,
    warehouseId: input.warehouseId,
    locationId: line.locationId,
    productId: line.product.id,
    variantId: line.variant.id,
    reason: input.reason,
    quantity: measured.quantity,
    systemQuantity,
    countedQuantity: measured.countedQuantity,
    variance: measured.variance,
    note: input.note.trim(),
    documents,
    status: "pending",
    requestedBy: actorId,
    requestedAt: new Date().toISOString(),
    decidedBy: null,
    decidedAt: null,
    decisionNote: "",
  };
  // Sensitive adjustments (per the matching rule) need a detailed note and documents.
  checkEvidence(adjustmentFacts(request), request);
  adjustmentsStore.setState((list) => [...list, request]);
  submitForApproval({
    kind: "adjustment",
    subjectId: request.id,
    reference: request.number,
    summary: adjustmentSummary(request),
    href: "/inventory/adjustments",
    facts: adjustmentFacts(request),
    evidence: adjustmentEvidence(request),
    requestedBy: actorId,
  });
  return findAdjustment(request.id);
}

// What a request form needs to tell the requester before they submit.
export function adjustmentRequirements(input: { warehouseId: string; variantId: string; reason: AdjustmentReason; quantity: number }) {
  return requirementsFor("adjustment", adjustmentFacts({ ...input, productId: variantsStore.getState().find((variant) => variant.id === input.variantId)?.productId ?? "" }));
}

function adjustmentSummary(request: AdjustmentRequest) {
  const product = productsStore.getState().find((candidate) => candidate.id === request.productId);
  const variant = variantsStore.getState().find((candidate) => candidate.id === request.variantId);
  return `${adjustmentEffects[request.reason].label}: ${request.quantity} × ${product?.name ?? "item"} (${variant?.sku ?? "?"})`;
}

// What approval rules match on: warehouse, reason, quantity and value at cost.
function adjustmentFacts(request: Pick<AdjustmentRequest, "warehouseId" | "variantId" | "productId" | "reason" | "quantity">) {
  const variant = variantsStore.getState().find((candidate) => candidate.id === request.variantId);
  const product = productsStore.getState().find((candidate) => candidate.id === request.productId);
  const unitCost = variant && product ? effectivePrices(variant, product).costPrice : 0;
  return { warehouseId: request.warehouseId, reason: request.reason, quantity: request.quantity, value: request.quantity * unitCost };
}

function findAdjustment(requestId: string) {
  const request = adjustmentsStore.getState().find((candidate) => candidate.id === requestId);
  if (!request) throw new StockError("Request not found.");
  return request;
}

const setAdjustment = (requestId: string, patch: Partial<AdjustmentRequest>) =>
  adjustmentsStore.setState((list) => list.map((candidate) => (candidate.id === requestId ? { ...candidate, ...patch } : candidate)));

// Final approval: re-check (stock and bins may have changed since the request), then post.
function postAdjustment(requestId: string, actorId: string) {
  const request = findAdjustment(requestId);
  if (request.status !== "pending") throw new StockError("It isn't waiting for approval.");
  const variant = variantsStore.getState().find((candidate) => candidate.id === request.variantId);
  const product = productsStore.getState().find((candidate) => candidate.id === request.productId);
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === request.warehouseId);
  if (!warehouse || !product) throw new StockError("The warehouse or product no longer exists.");
  // A count is only true for the stock it was compared with.
  if (request.countedQuantity !== null) {
    const now = heldIn(systemBucket(request.reason), request.variantId, request.warehouseId, request.locationId);
    if (now !== request.systemQuantity) {
      throw new StockError(`Stock has changed since the count (system was ${request.systemQuantity}, now ${now}). Return it so it can be recounted.`);
    }
  }
  assertAdjustmentLocation(warehouse, request.reason, { locationId: request.locationId, quantity: request.quantity, product });
  assertSourceHasStock(request.reason, request.variantId, request.warehouseId, request.locationId, request.quantity, variant?.sku ?? "this item");
  const at = new Date().toISOString();
  appendMovements(
    newGroupId(),
    adjustmentEffects[request.reason].changes.map(([bucket, sign]) => ({
      at,
      type: "adjustment" as const,
      productId: request.productId,
      variantId: request.variantId,
      warehouseId: request.warehouseId,
      locationId: request.locationId,
      bucket,
      quantity: sign * request.quantity,
      unitCost: null,
      reference: request.number,
      reason: adjustmentEffects[request.reason].label,
      actorId,
    })),
  );
  setAdjustment(requestId, { status: "approved", decidedBy: actorId, decidedAt: at, decisionNote: "" });
  emitEvent("stock.adjustmentDecided", { actorId, summary: `Posted ${request.number}: ${adjustmentEffects[request.reason].label}, ${request.quantity} units` });
}

// The approval engine decides; these apply its decisions to adjustments.
registerApprovalHandler("adjustment", {
  approved: postAdjustment,
  rejected: (requestId, actorId, comment) => {
    setAdjustment(requestId, { status: "rejected", decidedBy: actorId, decidedAt: new Date().toISOString(), decisionNote: comment });
    const request = findAdjustment(requestId);
    emitEvent("stock.adjustmentDecided", { actorId, summary: `Rejected ${request.number}: ${adjustmentEffects[request.reason].label}, ${request.quantity} units` });
  },
  returned: (requestId, _actorId, comment) => setAdjustment(requestId, { status: "returned", decisionNote: comment }),
});

export type ResubmitInput = {
  quantity: number;
  countedQuantity?: number | null;
  note: string;
  // The full list: documents already attached that are kept, plus new ones.
  documents?: (DocumentInput | SupportingDocument)[];
};

// The requester corrects a returned request and sends it back for approval.
// The system quantity is read again: approval starts over from today's stock.
export async function resubmitAdjustment(actorId: string, requestId: string, input: ResubmitInput): Promise<void> {
  const request = findAdjustment(requestId);
  if (request.status !== "returned") throw new StockError("Only returned requests can be resubmitted.");
  if (request.requestedBy !== actorId) throw new StockError("Only the requester can resubmit it.");
  const { warehouse } = context(actorId, "inventory.adjustment.request", request.warehouseId);
  const systemQuantity = heldIn(systemBucket(request.reason), request.variantId, request.warehouseId, request.locationId);
  const measured = measure(request.reason, systemQuantity, input.quantity, input.countedQuantity);
  const [line] = resolveLines([{ variantId: request.variantId, quantity: measured.quantity, locationId: request.locationId }]);
  if (!input.note.trim()) throw new StockError("Explain what happened.");
  assertAdjustmentLocation(warehouse, request.reason, line);
  assertSourceHasStock(request.reason, request.variantId, request.warehouseId, request.locationId, measured.quantity, line.variant.sku);
  const approval = requestForSubject("adjustment", requestId);
  if (!approval) throw new StockError("Its approval request is missing.");
  const corrected: AdjustmentRequest = {
    ...request,
    quantity: measured.quantity,
    systemQuantity,
    countedQuantity: measured.countedQuantity,
    variance: measured.variance,
    note: input.note.trim(),
    documents: attach(actorId, input.documents ?? request.documents),
    status: "pending",
    decisionNote: "",
  };
  checkEvidence(adjustmentFacts(corrected), corrected);
  setAdjustment(requestId, corrected);
  resubmit(actorId, approval.id, adjustmentFacts(corrected), adjustmentSummary(corrected), adjustmentEvidence(corrected), input.note.trim());
}

// A single decision on an adjustment's current approval level. The approvals
// inbox offers the full set (approve, reject, return for correction).
export function decisionBlocker(actorId: string, request: AdjustmentRequest): string | null {
  const approval = requestForSubject("adjustment", request.id);
  return approval ? approvalBlocker(actorId, approval) : "Already decided.";
}

export async function decideAdjustment(actorId: string, requestId: string, approve: boolean, note: string): Promise<void> {
  const approval = requestForSubject("adjustment", requestId);
  if (!approval) throw new StockError("Request not found.");
  try {
    await decide(actorId, approval.id, { action: approve ? "approve" : "reject", comment: approve ? note : note || "Rejected" });
  } catch (error) {
    if (error instanceof ApprovalError) throw new StockError(error.message);
    throw error;
  }
}
