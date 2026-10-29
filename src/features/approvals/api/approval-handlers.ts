import type { ApprovalKind } from "../types/approval";

// What each kind's module does when its request is decided. Kept in a module
// with no imports so the engine and the modules can both use it without an
// import cycle. "approved" runs before the decision is recorded: if it throws
// (say, stock ran out in the meantime) the approval doesn't happen.
export type ApprovalHandler = {
  // automatic: set when a rule needed no approval (actorId is then the requester).
  approved: (subjectId: string, actorId: string, automatic?: { ruleName: string }) => void;
  rejected: (subjectId: string, actorId: string, comment: string) => void;
  returned: (subjectId: string, actorId: string, comment: string) => void;
};

const handlers = new Map<ApprovalKind, ApprovalHandler>();

export function registerApprovalHandler(kind: ApprovalKind, handler: ApprovalHandler) {
  handlers.set(kind, handler);
}

export function approvalHandler(kind: ApprovalKind) {
  const handler = handlers.get(kind);
  if (!handler) throw new Error(`No approval handler registered for ${kind}.`);
  return handler;
}
