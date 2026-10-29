// What needs approving. Each kind's module registers what happens on a
// decision (see api/approval-handlers.ts).
export type ApprovalKind = "adjustment" | "transfer" | "purchase";

// Who approves a level.
export type ApproverSpec =
  | { type: "permission" } // anyone with the kind's approve permission for the warehouse
  | { type: "role"; roleId: string }
  | { type: "department"; departmentId: string }
  | { type: "warehouse-manager" } // the manager of the request's warehouse (a transfer's source)
  | { type: "destination-manager" } // the manager of a transfer's destination
  | { type: "user"; userId: string };

export type ApprovalLevel = {
  name: string; // e.g. "Warehouse manager", "Finance"
  approver: ApproverSpec;
  // After this long without a decision, escalateTo may decide as well.
  escalateAfterHours: number | null;
  escalateTo: ApproverSpec | null;
};

// Every listed condition must hold; empty lists and nulls match anything.
export type RuleConditions = {
  warehouseIds: string[]; // the request's warehouse (a transfer's source)
  destinationWarehouseIds: string[]; // transfers only
  reasons: string[]; // adjustments only
  minValue: number | null; // value at cost
  maxValue: number | null;
  minQuantity: number | null;
  movement: "any" | "inter-warehouse" | "bin"; // transfers only
};

// What a request must carry before it can be submitted or approved.
export type EvidenceRequirements = {
  documents: number; // supporting documents (photos, delivery notes…); 0 for none
  detailedNote: boolean; // a note of at least DETAILED_NOTE_MIN characters
};

// A file attached as evidence. url is where it can be opened (in this
// frontend-only build, an object URL valid for the session).
export type SupportingDocument = {
  id: string;
  name: string;
  type: string;
  size: number; // bytes
  url: string;
  uploadedBy: string;
  uploadedAt: string;
};

// A file picked for upload, before it becomes a SupportingDocument.
export type DocumentUpload = { name: string; type: string; size: number; url: string };

// What the approver sees: the requester's note, the figures, the documents.
export type ApprovalEvidence = {
  note: string;
  details: { label: string; value: string }[];
  documents: SupportingDocument[];
};

export type ApprovalRule = {
  id: string;
  name: string;
  kind: ApprovalKind;
  active: boolean;
  priority: number; // lower first; the first matching rule applies
  conditions: RuleConditions;
  // No levels: matching requests go through without approval (only allowed for bin moves).
  levels: ApprovalLevel[];
  // Segregation of duties: the requester can't approve their own request.
  segregation: boolean;
  requirements: EvidenceRequirements;
  updatedBy: string;
  updatedAt: string;
};

// The facts a rule is matched against, supplied by the requesting module.
export type ApprovalFacts = {
  warehouseId: string;
  destinationWarehouseId?: string;
  value: number;
  quantity: number;
  reason?: string;
  binMove?: boolean;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "returned" | "cancelled";

export type DecisionAction = "submitted" | "approved" | "rejected" | "returned" | "escalated" | "resubmitted" | "cancelled" | "auto-approved";

// One entry of a request's history. Entries are frozen and only ever appended.
export type ApprovalDecision = Readonly<{
  at: string;
  actorId: string | null; // null: the system (escalation, auto-approval)
  level: number; // index into levels
  action: DecisionAction;
  comment: string;
}>;

export type ApprovalRequest = {
  id: string;
  kind: ApprovalKind;
  subjectId: string; // e.g. the adjustment's id
  reference: string; // e.g. ADJ-0003
  summary: string; // one line describing what's asked
  href: string; // the subject's page
  facts: ApprovalFacts;
  ruleId: string | null;
  ruleName: string;
  // Copied from the rule when submitted: later rule edits don't change it.
  levels: ApprovalLevel[];
  segregation: boolean;
  requirements: EvidenceRequirements;
  evidence: ApprovalEvidence;
  currentLevel: number;
  levelStartedAt: string;
  escalated: boolean; // the current level's escalation approvers may decide
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  decisions: readonly ApprovalDecision[];
};
