"use client";

import "../connected-modules";

import { useEffect, useMemo } from "react";

import type { StatusTone } from "@/components/shared/status-badge";
import { departmentName } from "@/config/departments";
import { useCurrentUser, useRoles, useUsers } from "@/features/access-control/hooks/use-access";
import { useStore } from "@/lib/create-store";

import { canViewRequest, decisionBlocker, requestsStore, rulesStore, runEscalations } from "../api/approvals-api";
import type { ApprovalStatus, ApproverSpec } from "../types/approval";

export const approvalStatusDisplay: Record<ApprovalStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  returned: { label: "Returned", tone: "info" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const useApprovalRules = () => useStore(rulesStore);

// Requests the current user may see, newest first. While mounted, overdue
// levels are escalated every minute (a backend would run this on a schedule).
export function useApprovalRequests() {
  const requests = useStore(requestsStore);
  const { user } = useCurrentUser();
  useEffect(() => {
    runEscalations();
    const timer = setInterval(() => runEscalations(), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(
    () => requests.filter((request) => canViewRequest(user.id, request)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [requests, user.id],
  );
}

// Requests waiting for the current user's decision.
export function useMyApprovals() {
  const requests = useApprovalRequests();
  const { user } = useCurrentUser();
  return requests.filter((request) => decisionBlocker(user.id, request) === null);
}

// "Role: Inventory Manager", "Finance department", …
export function useDescribeApprover() {
  const roles = useRoles();
  const users = useUsers();
  return (spec: ApproverSpec | null) => {
    if (!spec) return "—";
    switch (spec.type) {
      case "permission":
        return "Anyone who can approve this";
      case "role":
        return `Role: ${roles.find((role) => role.id === spec.roleId)?.name ?? "removed role"}`;
      case "department":
        return `${departmentName(spec.departmentId)} department`;
      case "warehouse-manager":
        return "The warehouse's manager";
      case "destination-manager":
        return "The receiving warehouse's manager";
      case "user":
        return users.find((user) => user.id === spec.userId)?.name ?? "removed user";
    }
  };
}
