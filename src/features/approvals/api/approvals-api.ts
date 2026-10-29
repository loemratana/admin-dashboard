import { rolesStore, usersStore } from "@/features/access-control/api/access-api";
import { notify } from "@/features/notifications/api/notifications-api";
import { variantsStore } from "@/features/product-variants/api/variants-api";
import { effectivePrices } from "@/features/product-variants/utils/variant-utils";
import { productsStore } from "@/features/products/api/products-api";
import { warehousesStore } from "@/features/warehouses/api/warehouses-api";
import type { PermissionKey } from "@/config/permissions";
import { can } from "@/lib/authorization";
import { createStore } from "@/lib/create-store";
import { emitEvent } from "@/lib/events";
import type { User } from "@/types/access";

import type {
  ApprovalDecision,
  ApprovalEvidence,
  ApprovalFacts,
  ApprovalKind,
  ApprovalLevel,
  ApprovalRequest,
  ApprovalRule,
  ApproverSpec,
  DecisionAction,
  EvidenceRequirements,
  RuleConditions,
} from "../types/approval";
import { approvalHandler } from "./approval-handlers";

// The approval engine, held in memory until the backend exists. Modules submit
// requests with the facts rules match on; the first matching rule decides the
// levels. Decisions are checked here (who may decide, in what order), and the
// final approval runs the module's handler, which applies the change.

export class ApprovalError extends Error {}

// The permission behind the { type: "permission" } approver, per kind.
export const approvePermission: Record<ApprovalKind, PermissionKey> = {
  adjustment: "inventory.adjustment.approve",
  transfer: "inventory.transfer.approve",
  purchase: "purchasing.order.approve",
};

// Kinds whose modules are connected to the engine so far.
export const liveKinds: ApprovalKind[] = ["adjustment", "transfer"];

export const kindLabels: Record<ApprovalKind, string> = { adjustment: "Stock adjustment", transfer: "Transfer", purchase: "Purchase order" };

export const DETAILED_NOTE_MIN = 20;
export const noRequirements = (): EvidenceRequirements => ({ documents: 0, detailedNote: false });

// Why the evidence doesn't meet the requirements, or null if it does.
export function evidenceProblem(requirements: EvidenceRequirements, evidence: Pick<ApprovalEvidence, "note" | "documents">) {
  const missing = [
    requirements.detailedNote && evidence.note.trim().length < DETAILED_NOTE_MIN && `a detailed note (at least ${DETAILED_NOTE_MIN} characters)`,
    evidence.documents.length < requirements.documents &&
      `${requirements.documents === 1 ? "a supporting document" : `${requirements.documents} supporting documents`}${evidence.documents.length > 0 ? ` (${evidence.documents.length} attached)` : ""}`,
  ].filter(Boolean);
  return missing.length > 0 ? `This needs ${missing.join(" and ")}.` : null;
}

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();
const anyConditions = (): RuleConditions => ({
  warehouseIds: [],
  destinationWarehouseIds: [],
  reasons: [],
  minValue: null,
  maxValue: null,
  minQuantity: null,
  movement: "any",
});

// ---- rules ------------------------------------------------------------------------

const RULES_SEEDED_AT = "2026-10-01T08:00:00Z";

export const rulesStore = createStore<ApprovalRule[]>([
  {
    id: "rule-adj-large-loss",
    name: "Large losses and write-offs",
    kind: "adjustment",
    active: true,
    priority: 1,
    conditions: { ...anyConditions(), reasons: ["lost", "write-off-damaged", "write-off-quarantined", "correction-decrease"], minValue: 500 },
    levels: [
      { name: "Warehouse manager", approver: { type: "warehouse-manager" }, escalateAfterHours: 24, escalateTo: { type: "role", roleId: "inventory-manager" } },
      { name: "Finance", approver: { type: "department", departmentId: "dept-finance" }, escalateAfterHours: 48, escalateTo: { type: "role", roleId: "admin" } },
    ],
    segregation: true,
    requirements: { documents: 1, detailedNote: true },
    updatedBy: "u-01",
    updatedAt: RULES_SEEDED_AT,
  },
  {
    id: "rule-adj-bulk",
    name: "Bulk corrections (100+ units)",
    kind: "adjustment",
    active: true,
    priority: 2,
    conditions: { ...anyConditions(), minQuantity: 100 },
    levels: [
      { name: "Inventory approver", approver: { type: "permission" }, escalateAfterHours: 24, escalateTo: { type: "role", roleId: "admin" } },
      { name: "Operations lead", approver: { type: "role", roleId: "inventory-manager" }, escalateAfterHours: null, escalateTo: null },
    ],
    segregation: true,
    requirements: { documents: 0, detailedNote: true },
    updatedBy: "u-01",
    updatedAt: RULES_SEEDED_AT,
  },
  {
    id: "rule-adj-default",
    name: "All other adjustments",
    kind: "adjustment",
    active: true,
    priority: 99,
    conditions: anyConditions(),
    levels: [{ name: "Inventory approver", approver: { type: "permission" }, escalateAfterHours: 24, escalateTo: { type: "role", roleId: "admin" } }],
    segregation: true,
    requirements: noRequirements(),
    updatedBy: "u-01",
    updatedAt: RULES_SEEDED_AT,
  },
  {
    id: "rule-trf-bin",
    name: "Low-value bin moves",
    kind: "transfer",
    active: true,
    priority: 1,
    conditions: { ...anyConditions(), movement: "bin", maxValue: 1000 },
    levels: [],
    segregation: true,
    requirements: noRequirements(),
    updatedBy: "u-01",
    updatedAt: RULES_SEEDED_AT,
  },
  {
    id: "rule-trf-high-value",
    name: "High-value transfers",
    kind: "transfer",
    active: true,
    priority: 2,
    conditions: { ...anyConditions(), movement: "inter-warehouse", minValue: 5000 },
    levels: [
      { name: "Sending manager", approver: { type: "warehouse-manager" }, escalateAfterHours: 24, escalateTo: { type: "role", roleId: "inventory-manager" } },
      { name: "Receiving manager", approver: { type: "destination-manager" }, escalateAfterHours: 24, escalateTo: { type: "role", roleId: "admin" } },
    ],
    segregation: true,
    requirements: { documents: 0, detailedNote: true },
    updatedBy: "u-01",
    updatedAt: RULES_SEEDED_AT,
  },
  {
    id: "rule-trf-default",
    name: "All other transfers",
    kind: "transfer",
    active: true,
    priority: 99,
    conditions: anyConditions(),
    levels: [{ name: "Transfer approver", approver: { type: "permission" }, escalateAfterHours: 24, escalateTo: { type: "role", roleId: "admin" } }],
    segregation: true,
    requirements: noRequirements(),
    updatedBy: "u-01",
    updatedAt: RULES_SEEDED_AT,
  },
]);

// Used when no active rule matches: one level, anyone with the approve permission.
const fallbackLevels = (): ApprovalLevel[] => [{ name: "Approver", approver: { type: "permission" }, escalateAfterHours: null, escalateTo: null }];

export function ruleMatches(rule: ApprovalRule, facts: ApprovalFacts) {
  const c = rule.conditions;
  if (c.warehouseIds.length > 0 && !c.warehouseIds.includes(facts.warehouseId)) return false;
  if (c.destinationWarehouseIds.length > 0 && !(facts.destinationWarehouseId && c.destinationWarehouseIds.includes(facts.destinationWarehouseId))) return false;
  if (c.reasons.length > 0 && !(facts.reason && c.reasons.includes(facts.reason))) return false;
  if (c.minValue !== null && facts.value < c.minValue) return false;
  if (c.maxValue !== null && facts.value > c.maxValue) return false;
  if (c.minQuantity !== null && facts.quantity < c.minQuantity) return false;
  if (c.movement === "bin" && !facts.binMove) return false;
  if (c.movement === "inter-warehouse" && facts.binMove) return false;
  return true;
}

export function matchRule(kind: ApprovalKind, facts: ApprovalFacts): ApprovalRule | null {
  return (
    rulesStore
      .getState()
      .filter((rule) => rule.kind === kind && rule.active)
      .sort((a, b) => a.priority - b.priority)
      .find((rule) => ruleMatches(rule, facts)) ?? null
  );
}

const actorOf = (actorId: string) => usersStore.getState().find((user) => user.id === actorId);

function assertCanManageRules(actorId: string) {
  const actor = actorOf(actorId);
  if (!actor || !can(actor, rolesStore.getState(), "approvals.rule.manage")) throw new ApprovalError("You can't manage approval rules.");
}

export type RuleInput = Pick<ApprovalRule, "name" | "kind" | "active" | "conditions" | "levels" | "segregation" | "requirements">;

function validateRule(input: RuleInput) {
  if (!input.name.trim()) throw new ApprovalError("Give the rule a name.");
  const c = input.conditions;
  for (const [label, value] of [["Minimum value", c.minValue], ["Maximum value", c.maxValue], ["Minimum quantity", c.minQuantity]] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new ApprovalError(`${label} must be 0 or more.`);
  }
  if (c.minValue !== null && c.maxValue !== null && c.minValue > c.maxValue) throw new ApprovalError("The minimum value is above the maximum.");
  if (!Number.isInteger(input.requirements.documents) || input.requirements.documents < 0 || input.requirements.documents > 5) {
    throw new ApprovalError("Required documents must be a whole number from 0 to 5.");
  }
  // Skipping approval is only for low-risk bin moves.
  if (input.levels.length === 0 && !(input.kind === "transfer" && c.movement === "bin")) {
    throw new ApprovalError("Add at least one approval level. Only bin-to-bin transfers may skip approval.");
  }
  input.levels.forEach((level, index) => {
    if (!level.name.trim()) throw new ApprovalError(`Name level ${index + 1}.`);
    assertSpec(level.approver, `Level ${index + 1}`);
    if (level.escalateAfterHours !== null) {
      if (!Number.isFinite(level.escalateAfterHours) || level.escalateAfterHours <= 0) throw new ApprovalError(`Level ${index + 1}: escalate after a positive number of hours.`);
      if (!level.escalateTo) throw new ApprovalError(`Level ${index + 1}: choose who it escalates to.`);
      assertSpec(level.escalateTo, `Level ${index + 1} escalation`);
    }
  });
}

function assertSpec(spec: ApproverSpec, where: string) {
  if (spec.type === "role" && !rolesStore.getState().some((role) => role.id === spec.roleId)) throw new ApprovalError(`${where}: choose a role.`);
  if (spec.type === "department" && !spec.departmentId) throw new ApprovalError(`${where}: choose a department.`);
  if (spec.type === "user" && !usersStore.getState().some((user) => user.id === spec.userId && user.status === "active")) throw new ApprovalError(`${where}: choose an active user.`);
}

const cleanRule = (input: RuleInput) => ({
  ...input,
  name: input.name.trim(),
  levels: input.levels.map((level) => ({ ...level, name: level.name.trim(), escalateTo: level.escalateAfterHours === null ? null : level.escalateTo })),
});

export async function createRule(actorId: string, input: RuleInput): Promise<ApprovalRule> {
  assertCanManageRules(actorId);
  validateRule(input);
  const sameKind = rulesStore.getState().filter((rule) => rule.kind === input.kind);
  // New rules go just before the catch-all (the last rule), so they can take effect.
  const last = [...sameKind].sort((a, b) => a.priority - b.priority).at(-1);
  const priority = last ? last.priority - 0.5 : 1;
  const rule: ApprovalRule = { ...cleanRule(input), id: randomId("rule"), priority, updatedBy: actorId, updatedAt: now() };
  rulesStore.setState((list) => normalisePriorities([...list, rule], input.kind));
  emitEvent("approval.ruleChanged", { actorId, summary: `Created approval rule "${rule.name}"` });
  return rule;
}

export async function updateRule(actorId: string, ruleId: string, input: RuleInput): Promise<void> {
  assertCanManageRules(actorId);
  validateRule(input);
  const before = rulesStore.getState().find((rule) => rule.id === ruleId);
  if (!before) throw new ApprovalError("Rule not found.");
  if (before.kind !== input.kind) throw new ApprovalError("A rule's type can't change.");
  rulesStore.setState((list) => list.map((rule) => (rule.id === ruleId ? { ...rule, ...cleanRule(input), updatedBy: actorId, updatedAt: now() } : rule)));
  emitEvent("approval.ruleChanged", { actorId, summary: `Updated approval rule "${input.name.trim()}"` });
}

export async function deleteRule(actorId: string, ruleId: string): Promise<void> {
  assertCanManageRules(actorId);
  const rule = rulesStore.getState().find((candidate) => candidate.id === ruleId);
  if (!rule) throw new ApprovalError("Rule not found.");
  rulesStore.setState((list) => normalisePriorities(list.filter((candidate) => candidate.id !== ruleId), rule.kind));
  emitEvent("approval.ruleChanged", { actorId, summary: `Deleted approval rule "${rule.name}"` });
}

// Moves a rule one place earlier (-1) or later (+1) among its kind.
export async function moveRule(actorId: string, ruleId: string, direction: -1 | 1): Promise<void> {
  assertCanManageRules(actorId);
  const rule = rulesStore.getState().find((candidate) => candidate.id === ruleId);
  if (!rule) throw new ApprovalError("Rule not found.");
  const ordered = rulesStore
    .getState()
    .filter((candidate) => candidate.kind === rule.kind)
    .sort((a, b) => a.priority - b.priority);
  const index = ordered.findIndex((candidate) => candidate.id === ruleId);
  const target = index + direction;
  if (target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const priorities = new Map(ordered.map((candidate, position) => [candidate.id, position + 1]));
  rulesStore.setState((list) => list.map((candidate) => (priorities.has(candidate.id) ? { ...candidate, priority: priorities.get(candidate.id)! } : candidate)));
  emitEvent("approval.ruleChanged", { actorId, summary: `Moved approval rule "${rule.name}" ${direction < 0 ? "up" : "down"}` });
}

// Renumbers a kind's rules 1, 2, 3… keeping their order.
function normalisePriorities(list: ApprovalRule[], kind: ApprovalKind) {
  const ordered = list.filter((rule) => rule.kind === kind).sort((a, b) => a.priority - b.priority);
  const priorities = new Map(ordered.map((rule, position) => [rule.id, position + 1]));
  return list.map((rule) => (priorities.has(rule.id) ? { ...rule, priority: priorities.get(rule.id)! } : rule));
}

// ---- who may decide ------------------------------------------------------------------

export function matchesSpec(user: User, spec: ApproverSpec, request: Pick<ApprovalRequest, "kind" | "facts">) {
  switch (spec.type) {
    case "permission":
      return can(user, rolesStore.getState(), approvePermission[request.kind], { warehouseId: request.facts.warehouseId });
    case "role":
      return user.roleIds.includes(spec.roleId);
    case "department":
      return user.departmentId === spec.departmentId;
    case "warehouse-manager":
      return warehousesStore.getState().find((warehouse) => warehouse.id === request.facts.warehouseId)?.managerId === user.id;
    case "destination-manager":
      return !!request.facts.destinationWarehouseId && warehousesStore.getState().find((warehouse) => warehouse.id === request.facts.destinationWarehouseId)?.managerId === user.id;
    case "user":
      return user.id === spec.userId;
  }
}

// Why this user can't decide the request's current level, or null if they can.
export function decisionBlocker(actorId: string, request: ApprovalRequest): string | null {
  if (request.status !== "pending") return "Already decided.";
  const actor = actorOf(actorId);
  if (!actor || actor.status !== "active") return "You can't decide this.";
  if (request.segregation && request.requestedBy === actorId) return "You can't approve your own request.";
  // One person signs off at most one level of a request.
  if (request.decisions.some((decision) => decision.action === "approved" && decision.actorId === actorId)) return "You've already approved an earlier level.";
  const level = request.levels[request.currentLevel];
  if (matchesSpec(actor, level.approver, request)) return null;
  if (request.escalated && level.escalateTo && matchesSpec(actor, level.escalateTo, request)) return null;
  return `You can't approve this: it's waiting for ${level.name}.`;
}

// Everyone who could decide the current level right now.
export function currentApprovers(request: ApprovalRequest) {
  if (request.status !== "pending") return [];
  return usersStore.getState().filter((user) => decisionBlocker(user.id, request) === null);
}

// When the current level escalates, or null if it doesn't.
export function escalationDue(request: ApprovalRequest) {
  const hours = request.levels[request.currentLevel]?.escalateAfterHours;
  if (request.status !== "pending" || !hours) return null;
  return new Date(new Date(request.levelStartedAt).getTime() + hours * 3_600_000).toISOString();
}

// ---- requests ------------------------------------------------------------------------

const decision = (actorId: string | null, level: number, action: DecisionAction, comment = ""): ApprovalDecision =>
  Object.freeze({ at: now(), actorId, level, action, comment });

const valueOf = (variantId: string, quantity: number) => {
  const variant = variantsStore.getState().find((candidate) => candidate.id === variantId);
  const product = variant && productsStore.getState().find((candidate) => candidate.id === variant.productId);
  return variant && product ? quantity * effectivePrices(variant, product).costPrice : 0;
};

const itemName = (variantId: string) => {
  const variant = variantsStore.getState().find((candidate) => candidate.id === variantId);
  const product = variant && productsStore.getState().find((candidate) => candidate.id === variant.productId);
  return `${product?.name ?? "item"} (${variant?.sku ?? "?"})`;
};

// Requests behind the sample adjustments (ADJ-0001..3), so they have a history.
function seededRequests(): ApprovalRequest[] {
  const level = rulesStore.getState().find((rule) => rule.id === "rule-adj-default")!.levels;
  const base = (id: string, subjectId: string, reference: string, summary: string, warehouseId: string, variantId: string, quantity: number, reason: string, by: string, at: string, note: string) => ({
    id,
    kind: "adjustment" as const,
    subjectId,
    reference,
    // Same wording as stock-api uses for new requests.
    summary: `${summary}: ${quantity} × ${itemName(variantId)}`,
    href: "/inventory/adjustments",
    facts: { warehouseId, value: valueOf(variantId, quantity), quantity, reason },
    ruleId: "rule-adj-default",
    ruleName: "All other adjustments",
    levels: level,
    segregation: true,
    requirements: noRequirements(),
    evidence: { note, details: [], documents: [] },
    currentLevel: 0,
    levelStartedAt: at,
    escalated: false,
    requestedBy: by,
    requestedAt: at,
  });
  const frozen = (entries: Omit<ApprovalDecision, never>[]) => entries.map((entry) => Object.freeze({ ...entry }));
  return [
    {
      ...base("apr-1", "adj-1", "ADJ-0001", "Damaged (move to damaged)", "wh-main", "var-prd-0018-0", 6, "damaged", "u-04", "2026-10-23T09:05:00Z", "Crushed in a dropped carton"),
      status: "approved",
      decisions: frozen([
        { at: "2026-10-23T09:05:00Z", actorId: "u-04", level: 0, action: "submitted", comment: "" },
        { at: "2026-10-23T11:15:00Z", actorId: "u-03", level: 0, action: "approved", comment: "" },
      ]),
    },
    {
      ...base("apr-2", "adj-2", "ADJ-0002", "Damaged (move to damaged)", "wh-east", "var-prd-0005-0", 2, "damaged", "u-10", "2026-10-24T15:20:00Z", "Cracked lenses on arrival"),
      status: "approved",
      decisions: frozen([
        { at: "2026-10-24T15:20:00Z", actorId: "u-10", level: 0, action: "submitted", comment: "" },
        { at: "2026-10-24T16:40:00Z", actorId: "u-03", level: 0, action: "approved", comment: "Photos checked" },
      ]),
    },
    {
      ...base("apr-3", "adj-3", "ADJ-0003", "Lost or missing", "wh-main", "var-prd-0008-0", 3, "lost", "u-04", "2026-10-26T08:45:00Z", "Packs missing after cycle count"),
      status: "pending",
      decisions: frozen([{ at: "2026-10-26T08:45:00Z", actorId: "u-04", level: 0, action: "submitted", comment: "" }]),
    },
    {
      id: "apr-4",
      kind: "transfer",
      subjectId: "trf-1",
      reference: "TRF-0001",
      summary: "Main warehouse → East depot: 25 units, 2 items",
      href: "/inventory/transfers/trf-1",
      facts: { warehouseId: "wh-main", destinationWarehouseId: "wh-east", quantity: 25, value: valueOf("var-prd-0001-0", 20) + valueOf("var-prd-0005-0", 5), binMove: false },
      ruleId: "rule-trf-default",
      ruleName: "All other transfers",
      levels: rulesStore.getState().find((rule) => rule.id === "rule-trf-default")!.levels,
      segregation: true,
      requirements: noRequirements(),
      evidence: { note: "Rebalance for the East depot weekend sale", details: [{ label: "Items", value: "2" }, { label: "Units", value: "25" }], documents: [] },
      currentLevel: 0,
      levelStartedAt: "2026-10-26T15:00:00Z",
      escalated: false,
      status: "pending",
      requestedBy: "u-03",
      requestedAt: "2026-10-26T15:00:00Z",
      decisions: frozen([{ at: "2026-10-26T15:00:00Z", actorId: "u-03", level: 0, action: "submitted", comment: "" }]),
    },
  ];
}

export const requestsStore = createStore<ApprovalRequest[]>(seededRequests());

function find(requestId: string) {
  const request = requestsStore.getState().find((candidate) => candidate.id === requestId);
  if (!request) throw new ApprovalError("Approval request not found.");
  return request;
}

function update(requestId: string, change: (request: ApprovalRequest) => ApprovalRequest) {
  requestsStore.setState((list) => list.map((request) => (request.id === requestId ? change(request) : request)));
}

const append = (request: ApprovalRequest, entry: ApprovalDecision) => Object.freeze([...request.decisions, entry]);

function notifyApprovers(request: ApprovalRequest, subject: string) {
  notify(
    currentApprovers(request).map((user) => user.id),
    { subject, body: `${request.summary}. ${request.levels[request.currentLevel].name} approval needed (level ${request.currentLevel + 1} of ${request.levels.length}).`, href: `/approvals/${request.id}` },
  );
}

const describe = (request: ApprovalRequest) => `${kindLabels[request.kind]} ${request.reference}`;

export type SubmitInput = {
  kind: ApprovalKind;
  subjectId: string;
  reference: string;
  summary: string;
  href: string;
  facts: ApprovalFacts;
  evidence: ApprovalEvidence;
  requestedBy: string;
};

// What the matching rule asks for, so a form can say so before submitting.
export function requirementsFor(kind: ApprovalKind, facts: ApprovalFacts) {
  const rule = matchRule(kind, facts);
  return { ruleName: rule?.name ?? "Default", requirements: rule?.requirements ?? noRequirements() };
}

export function assertEvidence(kind: ApprovalKind, facts: ApprovalFacts, evidence: Pick<ApprovalEvidence, "note" | "documents">) {
  const { ruleName, requirements } = requirementsFor(kind, facts);
  const problem = evidenceProblem(requirements, evidence);
  if (problem) throw new ApprovalError(`${problem} (rule: ${ruleName})`);
}

// Opens an approval request for a subject. With no levels to pass (a bypass
// rule) it's approved at once and the handler applies the change.
export function submitForApproval(input: SubmitInput): ApprovalRequest {
  assertEvidence(input.kind, input.facts, input.evidence);
  const rule = matchRule(input.kind, input.facts);
  const at = now();
  const request: ApprovalRequest = {
    ...input,
    id: randomId("apr"),
    ruleId: rule?.id ?? null,
    ruleName: rule?.name ?? "Default",
    levels: rule ? rule.levels : fallbackLevels(),
    segregation: rule?.segregation ?? true,
    requirements: rule?.requirements ?? noRequirements(),
    currentLevel: 0,
    levelStartedAt: at,
    escalated: false,
    status: "pending",
    requestedAt: at,
    decisions: Object.freeze([decision(input.requestedBy, 0, "submitted")]),
  };
  if (request.levels.length === 0) {
    approvalHandler(input.kind).approved(input.subjectId, input.requestedBy, { ruleName: request.ruleName });
    const done = { ...request, status: "approved" as const, decisions: append(request, decision(null, 0, "auto-approved", `No approval needed (${request.ruleName})`)) };
    requestsStore.setState((list) => [...list, done]);
    return done;
  }
  requestsStore.setState((list) => [...list, request]);
  notifyApprovers(request, `Approval needed: ${describe(request)}`);
  return request;
}

export type DecisionInput = { action: "approve" | "reject" | "return"; comment: string };

export async function decide(actorId: string, requestId: string, input: DecisionInput): Promise<ApprovalRequest> {
  runEscalations();
  const request = find(requestId);
  const blocker = decisionBlocker(actorId, request);
  if (blocker) throw new ApprovalError(blocker);
  const comment = input.comment.trim();
  if (input.action !== "approve" && !comment) {
    throw new ApprovalError(input.action === "reject" ? "Give a reason for rejecting it." : "Say what needs correcting.");
  }
  const handler = approvalHandler(request.kind);
  const level = request.currentLevel;
  const actorName = actorOf(actorId)?.name ?? "Someone";

  if (input.action === "approve") {
    // The evidence the rule required must still be there.
    const problem = evidenceProblem(request.requirements, request.evidence);
    if (problem) throw new ApprovalError(`Can't approve yet. ${problem}`);
    const last = level === request.levels.length - 1;
    // The handler applies the change; if it can't, nothing is recorded.
    if (last) handler.approved(request.subjectId, actorId);
    update(requestId, (current) => ({
      ...current,
      status: last ? "approved" : "pending",
      currentLevel: last ? level : level + 1,
      levelStartedAt: last ? current.levelStartedAt : now(),
      escalated: false,
      decisions: append(current, decision(actorId, level, "approved", comment)),
    }));
    const next = find(requestId);
    if (last) {
      notify([request.requestedBy], { subject: `Approved: ${describe(request)}`, body: `${actorName} gave final approval. ${request.summary}.`, href: `/approvals/${request.id}` });
    } else {
      notifyApprovers(next, `Approval needed: ${describe(request)}`);
    }
  } else {
    if (input.action === "reject") handler.rejected(request.subjectId, actorId, comment);
    else handler.returned(request.subjectId, actorId, comment);
    update(requestId, (current) => ({
      ...current,
      status: input.action === "reject" ? "rejected" : "returned",
      decisions: append(current, decision(actorId, level, input.action === "reject" ? "rejected" : "returned", comment)),
    }));
    notify([request.requestedBy], {
      subject: `${input.action === "reject" ? "Rejected" : "Returned for correction"}: ${describe(request)}`,
      body: `${actorName}: ${comment}`,
      href: `/approvals/${request.id}`,
    });
  }
  const verb = input.action === "approve" ? (find(requestId).status === "approved" ? "Approved" : `Approved level ${level + 1} of ${request.levels.length} for`) : input.action === "reject" ? "Rejected" : "Returned";
  emitEvent("approval.decided", { actorId, summary: `${verb} ${request.reference} (${kindLabels[request.kind].toLowerCase()})${comment ? `: ${comment}` : ""}` });
  return find(requestId);
}

// The requester sends a returned request back after correcting the subject.
// Facts may have changed, so the rule is matched again and approval restarts.
export function resubmit(actorId: string, requestId: string, facts: ApprovalFacts, summary: string, evidence: ApprovalEvidence, comment = ""): ApprovalRequest {
  const request = find(requestId);
  if (request.status !== "returned") throw new ApprovalError("Only returned requests can be resubmitted.");
  if (request.requestedBy !== actorId) throw new ApprovalError("Only the requester can resubmit it.");
  assertEvidence(request.kind, facts, evidence);
  const rule = matchRule(request.kind, facts);
  update(requestId, (current) => ({
    ...current,
    facts,
    summary,
    evidence,
    requirements: rule?.requirements ?? noRequirements(),
    ruleId: rule?.id ?? null,
    ruleName: rule?.name ?? "Default",
    levels: rule ? rule.levels : fallbackLevels(),
    segregation: rule?.segregation ?? true,
    currentLevel: 0,
    levelStartedAt: now(),
    escalated: false,
    status: "pending",
    decisions: append(current, decision(actorId, 0, "resubmitted", comment.trim())),
  }));
  const next = find(requestId);
  notifyApprovers(next, `Resubmitted for approval: ${describe(next)}`);
  return next;
}

// Withdraws a request that's still open (the subject was cancelled).
export function cancelRequest(actorId: string, requestId: string, comment = "") {
  const request = find(requestId);
  if (request.status !== "pending" && request.status !== "returned") throw new ApprovalError("It's already decided.");
  update(requestId, (current) => ({ ...current, status: "cancelled", decisions: append(current, decision(actorId, current.currentLevel, "cancelled", comment.trim())) }));
}

// Opens overdue levels to their escalation approvers and tells them. Safe to
// call often; each level escalates once.
export function runEscalations(at = new Date()) {
  for (const request of requestsStore.getState()) {
    const due = escalationDue(request);
    if (!due || request.escalated || new Date(due) > at) continue;
    const level = request.levels[request.currentLevel];
    update(request.id, (current) => ({
      ...current,
      escalated: true,
      decisions: append(current, decision(null, current.currentLevel, "escalated", `No decision within ${level.escalateAfterHours} hours`)),
    }));
    notifyApprovers(find(request.id), `Escalated: ${describe(request)} is overdue`);
  }
}

export const requestForSubject = (kind: ApprovalKind, subjectId: string) =>
  requestsStore
    .getState()
    .filter((request) => request.kind === kind && request.subjectId === subjectId)
    .at(-1);

// Requests a user is involved in: asked, decided or able to decide, or all of them with the view permission.
export function canViewRequest(actorId: string, request: ApprovalRequest) {
  const actor = actorOf(actorId);
  if (!actor) return false;
  if (can(actor, rolesStore.getState(), "approvals.request.view")) return true;
  if (request.requestedBy === actorId || request.decisions.some((entry) => entry.actorId === actorId)) return true;
  return request.levels.some((level) => matchesSpec(actor, level.approver, request) || (level.escalateTo !== null && matchesSpec(actor, level.escalateTo, request)));
}

