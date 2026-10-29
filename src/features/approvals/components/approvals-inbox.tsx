"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CornerUpLeft, X } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan, useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

import { decisionBlocker, kindLabels } from "../api/approvals-api";
import { approvalStatusDisplay, useApprovalRequests } from "../hooks/use-approvals";
import type { ApprovalRequest, ApprovalStatus } from "../types/approval";
import { DecisionDialog, type DecisionAction } from "./decision-dialog";

type Tab = "mine" | ApprovalStatus | "all";

const tabs: { id: Tab; label: string }[] = [
  { id: "mine", label: "Needs my action" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "returned", label: "Returned" },
  { id: "all", label: "All" },
];

export function ApprovalsInbox() {
  const requests = useApprovalRequests();
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const canSeeCost = useCan("products.cost.view");
  const [tab, setTab] = useState<Tab>("mine");
  const [deciding, setDeciding] = useState<{ request: ApprovalRequest; action: DecisionAction } | null>(null);
  const [message, setMessage] = useState("");

  const actionable = (request: ApprovalRequest) => decisionBlocker(actor.id, request) === null;
  const counts = Object.fromEntries(
    tabs.map(({ id }) => [id, requests.filter((request) => (id === "mine" ? actionable(request) : id === "all" || request.status === id)).length]),
  ) as Record<Tab, number>;
  const rows = requests.filter((request) => (tab === "mine" ? actionable(request) : tab === "all" || request.status === tab));
  const nameOf = (id: string | null) => (id ? (users.find((user) => user.id === id)?.name ?? "—") : "System");

  return (
    <>
      <PageHeader title="Approvals" description="Requests waiting for a decision, and every decision made. Decisions are permanent and can't be edited." />
      <div role="group" aria-label="Show" className="mb-3 flex flex-wrap gap-1">
        {tabs.map(({ id, label }) => (
          <Button key={id} size="sm" variant={tab === id ? "secondary" : "ghost"} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
            <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{counts[id]}</span>
          </Button>
        ))}
      </div>
      {message && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Request</TableHead>
              <TableHead>What</TableHead>
              {canSeeCost && <TableHead className="text-right">Value</TableHead>}
              <TableHead>Requested</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {tab === "mine" ? "Nothing needs your decision." : "No requests."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((request) => {
              const { label, tone } = approvalStatusDisplay[request.status];
              const level = request.levels[request.currentLevel];
              return (
                <TableRow key={request.id}>
                  <TableCell className="pl-4">
                    <Link href={`/approvals/${request.id}`} className="font-mono text-xs font-medium hover:underline hover:underline-offset-4">
                      {request.reference}
                    </Link>
                    <p className="text-xs text-muted-foreground">{kindLabels[request.kind]}</p>
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">{request.summary}</TableCell>
                  {canSeeCost && <TableCell className="text-right tabular-nums">{formatCurrency(request.facts.value)}</TableCell>}
                  <TableCell>
                    {nameOf(request.requestedBy)}
                    <p className="text-xs text-muted-foreground">{formatDateTime(request.requestedAt)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge tone={tone}>{label}</StatusBadge>
                      {request.status === "pending" && request.escalated && <StatusBadge tone="danger">Escalated</StatusBadge>}
                    </div>
                    {request.status === "pending" && level && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Level {formatNumber(request.currentLevel + 1)} of {formatNumber(request.levels.length)} · {level.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {actionable(request) && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" aria-label={`Return ${request.reference}`} onClick={() => setDeciding({ request, action: "return" })}>
                          <CornerUpLeft data-icon="inline-start" />
                          Return
                        </Button>
                        <Button size="sm" variant="outline" aria-label={`Reject ${request.reference}`} onClick={() => setDeciding({ request, action: "reject" })}>
                          <X data-icon="inline-start" />
                          Reject
                        </Button>
                        <Button size="sm" aria-label={`Approve ${request.reference}`} onClick={() => setDeciding({ request, action: "approve" })}>
                          <Check data-icon="inline-start" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <DecisionDialog
        request={deciding?.request ?? null}
        action={deciding?.action ?? null}
        onOpenChange={(open) => !open && setDeciding(null)}
        onDecided={(next, action) =>
          setMessage(
            action === "approve"
              ? next.status === "approved"
                ? `${next.reference} approved. The change has been applied.`
                : `${next.reference}: level approved, now waiting for ${next.levels[next.currentLevel].name}.`
              : `${next.reference} ${action === "reject" ? "rejected" : "returned to the requester"}.`,
          )
        }
      />
    </>
  );
}
