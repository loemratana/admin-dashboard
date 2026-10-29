"use client";

import { useState } from "react";
import { Check, CornerUpLeft, ExternalLink, FileText, X } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCan, useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { useStore } from "@/lib/create-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

import { canViewRequest, currentApprovers, decisionBlocker, escalationDue, kindLabels, requestsStore } from "../api/approvals-api";
import { approvalStatusDisplay, useDescribeApprover } from "../hooks/use-approvals";
import type { DecisionAction as HistoryAction } from "../types/approval";
import { DecisionDialog, type DecisionAction } from "./decision-dialog";
import { formatBytes } from "./document-picker";

const historyLabels: Record<HistoryAction, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned for correction",
  escalated: "Escalated",
  resubmitted: "Resubmitted",
  cancelled: "Cancelled",
  "auto-approved": "Approved automatically",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export function ApprovalDetails({ requestId }: { requestId: string }) {
  const request = useStore(requestsStore).find((candidate) => candidate.id === requestId);
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const warehouses = useWarehouses();
  const canSeeCost = useCan("products.cost.view");
  const describe = useDescribeApprover();
  const [action, setAction] = useState<DecisionAction | null>(null);
  useBreadcrumbLabel(`/approvals/${requestId}`, request?.reference);

  if (!request || !canViewRequest(actor.id, request)) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Request not found</h1>
        <LinkButton href="/approvals" variant="outline" className="mt-2">
          Back to approvals
        </LinkButton>
      </div>
    );
  }

  const nameOf = (id: string | null) => (id ? (users.find((user) => user.id === id)?.name ?? "—") : "System");
  const warehouseName = (id: string | undefined) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? "—";
  const { label, tone } = approvalStatusDisplay[request.status];
  const blocker = decisionBlocker(actor.id, request);
  const waitingFor = currentApprovers(request);
  const due = escalationDue(request);
  // Approvals from the latest submission only (a resubmission starts over).
  const lastStart = Math.max(...request.decisions.map((entry, index) => (entry.action === "submitted" || entry.action === "resubmitted" ? index : -1)));
  const approvalAt = (level: number) => request.decisions.slice(lastStart).find((entry) => entry.action === "approved" && entry.level === level);

  return (
    <>
      <PageHeader
        title={request.reference}
        description={`${kindLabels[request.kind]} · ${request.summary}`}
        actions={
          blocker === null && (
            <>
              <Button variant="ghost" onClick={() => setAction("return")}>
                <CornerUpLeft data-icon="inline-start" />
                Return
              </Button>
              <Button variant="outline" onClick={() => setAction("reject")}>
                <X data-icon="inline-start" />
                Reject
              </Button>
              <Button onClick={() => setAction("approve")}>
                <Check data-icon="inline-start" />
                Approve
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        {request.status === "pending" && request.escalated && <StatusBadge tone="danger">Escalated</StatusBadge>}
        {request.status === "pending" && blocker && <span className="text-sm text-muted-foreground">{blocker}</span>}
        <LinkButton href={request.href} variant="ghost" size="sm">
          <ExternalLink data-icon="inline-start" />
          Open {kindLabels[request.kind].toLowerCase()}
        </LinkButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Approval levels</CardTitle>
              <CardDescription>
                From the rule “{request.ruleName}”, as it was when submitted. Each level is decided in order, by a different person.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol aria-label="Approval levels" className="flex flex-col gap-3">
                {request.levels.map((level, index) => {
                  const approved = approvalAt(index);
                  const current = request.status === "pending" && index === request.currentLevel;
                  return (
                    <li key={index} className={`rounded-md border p-3 text-sm ${current ? "border-ring" : "border-border"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {index + 1}. {level.name}
                        </span>
                        {approved ? (
                          <StatusBadge tone="success">Approved</StatusBadge>
                        ) : current ? (
                          <StatusBadge tone="warning">Waiting</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">{request.status === "pending" ? "Not yet" : "—"}</StatusBadge>
                        )}
                      </div>
                      <p className="text-muted-foreground">{describe(level.approver)}</p>
                      {level.escalateAfterHours !== null && (
                        <p className="text-xs text-muted-foreground">
                          Escalates to {describe(level.escalateTo)} after {formatNumber(level.escalateAfterHours)} h
                        </p>
                      )}
                      {approved && (
                        <p className="mt-1 text-xs">
                          {nameOf(approved.actorId)} · {formatDateTime(approved.at)}
                          {approved.comment && ` · “${approved.comment}”`}
                        </p>
                      )}
                      {current && (
                        <p className="mt-1 text-xs">
                          {waitingFor.length > 0 ? `Can decide: ${waitingFor.map((user) => user.name).join(", ")}` : "Nobody can decide this level yet."}
                          {due && !request.escalated && ` · escalates ${formatDateTime(due)}`}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              {(request.requirements.documents > 0 || request.requirements.detailedNote) && (
                <CardDescription>
                  Required by the rule:{" "}
                  {[
                    request.requirements.detailedNote && "a detailed note",
                    request.requirements.documents > 0 && (request.requirements.documents === 1 ? "1 supporting document" : `${request.requirements.documents} supporting documents`),
                  ]
                    .filter(Boolean)
                    .join(" and ")}
                  .
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="whitespace-pre-wrap">{request.evidence.note || <span className="text-muted-foreground">No note.</span>}</p>
              {request.evidence.details.length > 0 && (
                <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
                  {request.evidence.details.map((detail) => (
                    <div key={detail.label} className="rounded-md border border-border px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {request.evidence.documents.length > 0 ? (
                <ul aria-label="Supporting documents" className="flex flex-col gap-1">
                  {request.evidence.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <a href={document.url} target="_blank" rel="noreferrer" className="min-w-0 truncate underline-offset-4 hover:underline">
                        {document.name}
                      </a>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(document.size)} · {nameOf(document.uploadedBy)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No documents attached.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Row label="Requested by">{nameOf(request.requestedBy)}</Row>
                <Row label="Requested">{formatDateTime(request.requestedAt)}</Row>
                <Row label="Warehouse">{warehouseName(request.facts.warehouseId)}</Row>
                {request.facts.destinationWarehouseId && <Row label="To">{warehouseName(request.facts.destinationWarehouseId)}</Row>}
                <Row label="Quantity">{formatNumber(request.facts.quantity)}</Row>
                {canSeeCost && <Row label="Value at cost">{formatCurrency(request.facts.value)}</Row>}
                <Row label="Own approval">{request.segregation ? "Not allowed" : "Allowed"}</Row>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Decision history</CardTitle>
              <CardDescription>Permanent: entries are never edited or removed.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol aria-label="Decision history" className="flex flex-col gap-3">
                {request.decisions.map((entry, index) => (
                  <li key={index} className="border-l-2 border-border pl-3 text-sm">
                    <div className="font-medium">
                      {historyLabels[entry.action]}
                      {request.levels.length > 1 && ["approved", "rejected", "returned", "escalated"].includes(entry.action) && (
                        <span className="font-normal text-muted-foreground"> · level {entry.level + 1}</span>
                      )}
                    </div>
                    {entry.comment && <div className="text-muted-foreground">{entry.comment}</div>}
                    <div className="text-xs text-muted-foreground">
                      {nameOf(entry.actorId)} · {formatDateTime(entry.at)}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <DecisionDialog request={request} action={action} onOpenChange={(open) => !open && setAction(null)} />
    </>
  );
}
