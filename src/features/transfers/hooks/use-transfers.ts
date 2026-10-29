"use client";

import { useMemo } from "react";

import type { StatusTone } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useStore } from "@/lib/create-store";

import { canViewTransfer, transfersStore } from "../api/transfers-api";
import type { TransferStatus } from "../types/transfer";

export const transferStatusDisplay: Record<TransferStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending: { label: "Pending approval", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  "in-transit": { label: "In transit", tone: "info" },
  "partially-received": { label: "Partially received", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const openStatuses: TransferStatus[] = ["draft", "pending", "approved", "in-transit", "partially-received"];

// The transfers the current user may see, newest first.
export function useVisibleTransfers() {
  const transfers = useStore(transfersStore);
  const { user } = useCurrentUser();
  return useMemo(
    () => transfers.filter((transfer) => canViewTransfer(user.id, transfer)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [transfers, user.id],
  );
}
