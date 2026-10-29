"use client";

import { useMemo } from "react";

import type { StatusTone } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useStore } from "@/lib/create-store";

import { canViewCount, countsStore } from "../api/counts-api";
import type { CountStatus } from "../types/stock-count";

export const countStatusDisplay: Record<CountStatus, { label: string; tone: StatusTone }> = {
  counting: { label: "Counting", tone: "info" },
  review: { label: "In review", tone: "warning" },
  posted: { label: "Posted", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

// The counts the current user may see, newest first.
export function useVisibleCounts() {
  const counts = useStore(countsStore);
  const { user } = useCurrentUser();
  return useMemo(() => counts.filter((count) => canViewCount(user.id, count)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [counts, user.id]);
}
