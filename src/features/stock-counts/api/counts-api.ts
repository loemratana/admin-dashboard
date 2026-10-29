import { rolesStore, usersStore } from "@/features/access-control/api/access-api";
import { categoriesStore } from "@/features/catalog/api/catalog-api";
import { variantsStore } from "@/features/product-variants/api/variants-api";
import { productsStore } from "@/features/products/api/products-api";
import { appendMovements, movementsStore, newGroupId, StockError } from "@/features/stock/api/ledger-store";
import type { StockLevel, StockMovement } from "@/features/stock/types/stock";
import { binLevel, computeBinLevels, computeLevels, levelAt } from "@/features/stock/utils/stock-math";
import { locationsStore } from "@/features/warehouses/api/locations-api";
import { warehousesStore } from "@/features/warehouses/api/warehouses-api";
import type { PermissionKey } from "@/config/permissions";
import { can } from "@/lib/authorization";
import { createStore } from "@/lib/create-store";
import { emitEvent } from "@/lib/events";

import { variance, type CountEvent, type CountLine, type StockCount } from "../types/stock-count";

// Stock counts held in memory until the backend exists. Counting never changes
// stock by itself: only posting a reviewed count does, through the ledger, and
// the person who posts it can't be someone who counted it.

export { StockError as CountError };

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const good = (level: StockLevel) => level.available + level.reserved;

// What the system holds now for a line: good stock in the warehouse, or in the bin.
function systemQuantity(warehouseId: string, variantId: string, locationId: string | null) {
  const movements = movementsStore.getState();
  return good(locationId ? binLevel(computeBinLevels(movements), locationId, variantId) : levelAt(computeLevels(movements), variantId, warehouseId));
}

const event = (actorId: string, action: CountEvent["action"], detail = ""): CountEvent => ({ at: new Date().toISOString(), actorId, action, detail });

// The lines a new count starts with. Without bins: every active item in scope,
// plus anything in scope the warehouse still holds. With bins: each item in
// each bin that holds it; finds elsewhere are added while counting.
function initialLines(warehouseId: string, categoryId: string | null): CountLine[] {
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === warehouseId)!;
  const products = new Map(productsStore.getState().map((product) => [product.id, product]));
  const inScope = variantsStore.getState().flatMap((variant) => {
    const product = products.get(variant.productId);
    return product && (!categoryId || product.categoryId === categoryId) ? [{ variant, product }] : [];
  });
  const line = (productId: string, variantId: string, locationId: string | null, expected: number): CountLine => ({
    id: randomId("cnl"),
    productId,
    variantId,
    locationId,
    expected,
    counted: null,
    countedBy: null,
    countedAt: null,
    recount: false,
    added: false,
  });

  const movements = movementsStore.getState();
  if (!warehouse.trackBins) {
    const levels = computeLevels(movements);
    return inScope.flatMap(({ variant, product }) => {
      const expected = good(levelAt(levels, variant.id, warehouseId));
      const usable = variant.status === "active" && product.status !== "archived";
      return usable || expected > 0 ? [line(product.id, variant.id, null, expected)] : [];
    });
  }
  const bins = computeBinLevels(movements);
  const warehouseBins = locationsStore.getState().filter((location) => location.warehouseId === warehouseId && location.type === "bin");
  return warehouseBins.flatMap((bin) =>
    inScope.flatMap(({ variant, product }) => {
      const expected = good(binLevel(bins, bin.id, variant.id));
      return expected > 0 ? [line(product.id, variant.id, bin.id, expected)] : [];
    }),
  );
}

export const countsStore = createStore<StockCount[]>([
  {
    id: "cnt-1",
    number: "CNT-0001",
    warehouseId: "wh-east",
    categoryId: "cat-office",
    blind: false,
    note: "Monthly cycle count",
    status: "counting",
    lines: initialLines("wh-east", "cat-office"),
    createdBy: "u-03",
    createdAt: "2026-10-26T08:00:00Z",
    events: [{ at: "2026-10-26T08:00:00Z", actorId: "u-03", action: "started", detail: "Office Supplies" }],
  },
]);

// ---- who may do what ------------------------------------------------------------

export type CountAction = "count" | "submit" | "recount" | "post" | "cancel";

const actorOf = (actorId: string) => usersStore.getState().find((user) => user.id === actorId);
const allows = (actorId: string, permission: PermissionKey, warehouseId: string) => {
  const actor = actorOf(actorId);
  return !!actor && can(actor, rolesStore.getState(), permission, { warehouseId });
};

export const canViewCount = (actorId: string, count: Pick<StockCount, "warehouseId">) =>
  allows(actorId, "inventory.count.perform", count.warehouseId) || allows(actorId, "inventory.count.approve", count.warehouseId);

// Blind counts hide expected quantities until the count is submitted.
export const showsExpected = (count: Pick<StockCount, "blind" | "status">) => !count.blind || count.status !== "counting";

export function actionBlocker(actorId: string, count: StockCount, action: CountAction): string | null {
  switch (action) {
    case "count":
    case "submit":
      if (count.status !== "counting") return "Counting is closed.";
      if (!allows(actorId, "inventory.count.perform", count.warehouseId)) return "You can't count stock in this warehouse.";
      if (action === "submit" && count.lines.some((line) => line.counted === null)) return "Count every line first.";
      return null;
    case "recount":
    case "post":
      if (count.status !== "review") return "It isn't waiting for review.";
      if (!allows(actorId, "inventory.count.approve", count.warehouseId)) return "You can't approve counts for this warehouse.";
      // Separation of duties: whoever entered a quantity can't approve it.
      if (action === "post" && count.lines.some((line) => line.countedBy === actorId)) return "You counted part of this, so someone else must post it.";
      return null;
    case "cancel":
      if (count.status !== "counting" && count.status !== "review") return "It's already closed.";
      return count.createdBy === actorId || allows(actorId, "inventory.count.approve", count.warehouseId) ? null : "Only the person who started it or an approver can cancel it.";
  }
}

function find(countId: string) {
  const count = countsStore.getState().find((candidate) => candidate.id === countId);
  if (!count) throw new StockError("Count not found.");
  return count;
}

function assertAllowed(actorId: string, count: StockCount, action: CountAction) {
  const blocker = actionBlocker(actorId, count, action);
  if (blocker) throw new StockError(blocker);
}

function update(countId: string, change: (count: StockCount) => StockCount) {
  countsStore.setState((list) => list.map((count) => (count.id === countId ? change(count) : count)));
}

// ---- start, count, submit ---------------------------------------------------------

export type NewCountInput = { warehouseId: string; categoryId: string | null; blind: boolean; note: string };

export async function startCount(actorId: string, input: NewCountInput): Promise<StockCount> {
  if (!allows(actorId, "inventory.count.perform", input.warehouseId)) throw new StockError("You can't count stock in this warehouse.");
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === input.warehouseId);
  if (!warehouse || warehouse.status !== "active") throw new StockError("Choose an active warehouse.");
  const category = input.categoryId ? categoriesStore.getState().find((candidate) => candidate.id === input.categoryId) : null;
  if (input.categoryId && !category) throw new StockError("Choose a category.");
  if (countsStore.getState().some((count) => count.warehouseId === warehouse.id && (count.status === "counting" || count.status === "review"))) {
    throw new StockError(`${warehouse.name} already has a count in progress. Finish or cancel it first.`);
  }
  const lines = initialLines(warehouse.id, input.categoryId);
  if (lines.length === 0 && !warehouse.trackBins) throw new StockError("Nothing to count in that scope.");

  const numbers = countsStore.getState().map((count) => Number(count.number.slice(4)) || 0);
  const count: StockCount = {
    id: randomId("cnt"),
    number: `CNT-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`,
    warehouseId: warehouse.id,
    categoryId: input.categoryId,
    blind: input.blind,
    note: input.note.trim(),
    status: "counting",
    lines,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
    events: [event(actorId, "started", [category?.name ?? "All categories", input.blind && "blind"].filter(Boolean).join(", "))],
  };
  countsStore.setState((list) => [...list, count]);
  return count;
}

// quantities: lineId -> counted units. Lines left out keep what they had.
export async function recordCounts(actorId: string, countId: string, quantities: Record<string, number>): Promise<void> {
  const count = find(countId);
  assertAllowed(actorId, count, "count");
  const entries = Object.entries(quantities);
  if (entries.length === 0) throw new StockError("Enter at least one quantity.");
  for (const [lineId, quantity] of entries) {
    if (!count.lines.some((line) => line.id === lineId)) throw new StockError("A line isn't part of this count.");
    if (!Number.isInteger(quantity) || quantity < 0) throw new StockError("Counts must be whole numbers of 0 or more.");
  }
  const at = new Date().toISOString();
  update(countId, (current) => ({
    ...current,
    lines: current.lines.map((line) =>
      line.id in quantities ? { ...line, counted: quantities[line.id], countedBy: actorId, countedAt: at, recount: false } : line,
    ),
    events: [...current.events, event(actorId, "counted", `${entries.length} ${entries.length === 1 ? "line" : "lines"}`)],
  }));
}

// Something found that isn't on the list (another bin, or an item not expected here).
export async function addCountLine(actorId: string, countId: string, input: { variantId: string; locationId: string | null }): Promise<CountLine> {
  const count = find(countId);
  assertAllowed(actorId, count, "count");
  const warehouse = warehousesStore.getState().find((candidate) => candidate.id === count.warehouseId)!;
  const variant = variantsStore.getState().find((candidate) => candidate.id === input.variantId);
  const product = variant && productsStore.getState().find((candidate) => candidate.id === variant.productId);
  if (!variant || !product) throw new StockError("Choose an item.");
  if (count.categoryId && product.categoryId !== count.categoryId) throw new StockError("That item is outside this count's category.");
  if (warehouse.trackBins) {
    const bin = locationsStore.getState().find((location) => location.id === input.locationId);
    if (!bin || bin.warehouseId !== warehouse.id || bin.type !== "bin") throw new StockError("Choose the bin it was found in.");
  } else if (input.locationId) {
    throw new StockError(`${warehouse.name} doesn't track bins.`);
  }
  if (count.lines.some((line) => line.variantId === variant.id && line.locationId === input.locationId)) throw new StockError("That's already on the list.");

  const line: CountLine = {
    id: randomId("cnl"),
    productId: product.id,
    variantId: variant.id,
    locationId: input.locationId,
    expected: systemQuantity(warehouse.id, variant.id, input.locationId),
    counted: null,
    countedBy: null,
    countedAt: null,
    recount: false,
    added: true,
  };
  update(countId, (current) => ({ ...current, lines: [...current.lines, line] }));
  return line;
}

export async function submitCount(actorId: string, countId: string): Promise<void> {
  const count = find(countId);
  assertAllowed(actorId, count, "submit");
  const off = count.lines.filter((line) => variance(line) !== 0).length;
  update(countId, (current) => ({
    ...current,
    status: "review",
    events: [...current.events, event(actorId, "submitted", off === 0 ? "No differences" : `${off} ${off === 1 ? "line differs" : "lines differ"}`)],
  }));
}

// ---- review: recount or post -------------------------------------------------------

export async function requestRecount(actorId: string, countId: string, lineIds: string[], reason: string): Promise<void> {
  const count = find(countId);
  assertAllowed(actorId, count, "recount");
  if (lineIds.length === 0) throw new StockError("Choose the lines to recount.");
  if (!reason.trim()) throw new StockError("Say why they need recounting.");
  const ids = new Set(lineIds);
  update(countId, (current) => ({
    ...current,
    status: "counting",
    lines: current.lines.map((line) => (ids.has(line.id) ? { ...line, counted: null, countedBy: null, countedAt: null, recount: true } : line)),
    events: [...current.events, event(actorId, "recount", `${ids.size} ${ids.size === 1 ? "line" : "lines"}: ${reason.trim()}`)],
  }));
}

// Lines whose stock changed after they were added: someone moved stock during
// the count. Posting still applies the counted difference, which is right if
// that movement was recorded correctly, but a reviewer should look first.
export function movedDuringCount(count: StockCount) {
  return new Set(count.lines.filter((line) => systemQuantity(count.warehouseId, line.variantId, line.locationId) !== line.expected).map((line) => line.id));
}

export async function postCount(actorId: string, countId: string): Promise<void> {
  const count = find(countId);
  assertAllowed(actorId, count, "post");
  const variants = variantsStore.getState();
  const differing = count.lines.filter((line) => variance(line) !== 0);

  // Shortages come out of available stock; reserved units stay held for their orders.
  const movements = movementsStore.getState();
  const levels = computeLevels(movements);
  const bins = computeBinLevels(movements);
  for (const line of differing) {
    const short = -variance(line);
    if (short <= 0) continue;
    const available = (line.locationId ? binLevel(bins, line.locationId, line.variantId) : levelAt(levels, line.variantId, count.warehouseId)).available;
    if (short > available) {
      const sku = variants.find((variant) => variant.id === line.variantId)?.sku ?? "an item";
      throw new StockError(`${sku} is ${short} short but only ${available} are available; the rest are reserved. Release the reservation first.`);
    }
  }

  const at = new Date().toISOString();
  const lines: Omit<StockMovement, "id" | "groupId">[] = differing.map((line) => ({
    at,
    type: "count",
    productId: line.productId,
    variantId: line.variantId,
    warehouseId: count.warehouseId,
    locationId: line.locationId,
    bucket: "available",
    quantity: variance(line),
    unitCost: null,
    reference: count.number,
    reason: `Counted ${line.counted}, expected ${line.expected}`,
    actorId,
  }));
  if (lines.length > 0) appendMovements(newGroupId(), lines);

  const net = differing.reduce((sum, line) => sum + variance(line), 0);
  const detail = differing.length === 0 ? "No differences" : `${differing.length} ${differing.length === 1 ? "line" : "lines"}, net ${net > 0 ? "+" : ""}${net} units`;
  update(countId, (current) => ({ ...current, status: "posted", events: [...current.events, event(actorId, "posted", detail)] }));
  emitEvent("stock.countChanged", { actorId, summary: `Posted ${count.number}: ${detail}` });
}

export async function cancelCount(actorId: string, countId: string, reason: string): Promise<void> {
  const count = find(countId);
  assertAllowed(actorId, count, "cancel");
  update(countId, (current) => ({ ...current, status: "cancelled", events: [...current.events, event(actorId, "cancelled", reason.trim())] }));
  emitEvent("stock.countChanged", { actorId, summary: `Cancelled ${count.number}${reason.trim() ? `: ${reason.trim()}` : ""}` });
}
