"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Check, CornerUpLeft, Pencil, PackageCheck, Send, Truck, X } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { requestsStore } from "@/features/approvals/api/approvals-api";
import { DecisionDialog, type DecisionAction } from "@/features/approvals/components/decision-dialog";
import { BinSelect } from "@/features/stock/components/bin-select";
import { useStockItems } from "@/features/stock/hooks/use-stock-items";
import { useLocationCodes, useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { useStore } from "@/lib/create-store";
import { formatDateTime, formatNumber } from "@/lib/format";

import {
  actionBlocker,
  cancelTransfer,
  approvalFor,
  canViewTransfer,
  dispatchTransfer,
  receiveTransfer,
  submitTransfer,
  TransferError,
  transfersStore,
  type LineReceipt,
} from "../api/transfers-api";
import { transferStatusDisplay } from "../hooks/use-transfers";
import { inTransit, type Transfer, type TransferEvent } from "../types/transfer";

const eventLabels: Record<TransferEvent["action"], string> = {
  created: "Created",
  changed: "Changed",
  submitted: "Submitted for approval",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned for correction",
  cancelled: "Cancelled",
  dispatched: "Dispatched",
  received: "Received",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

const errorText = (cause: unknown, fallback: string) => (cause instanceof TransferError ? cause.message : fallback);

export function TransferDetails({ transferId }: { transferId: string }) {
  const transfer = useStore(transfersStore).find((candidate) => candidate.id === transferId);
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const warehouses = useWarehouses();
  const items = useStockItems();
  const codes = useLocationCodes();
  const [cancelling, setCancelling] = useState(false);
  const [deciding, setDeciding] = useState<DecisionAction | null>(null);
  // Re-render as approval levels are decided (the transfer itself only changes at the end).
  useStore(requestsStore);
  const [error, setError] = useState("");
  useBreadcrumbLabel(`/inventory/transfers/${transferId}`, transfer?.number);

  if (!transfer || !canViewTransfer(actor.id, transfer)) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Transfer not found</h1>
        <LinkButton href="/inventory/transfers" variant="outline" className="mt-2">
          Back to transfers
        </LinkButton>
      </div>
    );
  }

  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? id;
  const nameOf = (id: string | null) => users.find((user) => user.id === id)?.name ?? "—";
  const itemOf = (variantId: string) => items.find((item) => item.variant.id === variantId);
  const allowed = (action: Parameters<typeof actionBlocker>[2]) => actionBlocker(actor.id, transfer, action) === null;
  const { label, tone } = transferStatusDisplay[transfer.status];
  const binMove = transfer.sourceWarehouseId === transfer.destinationWarehouseId;

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(errorText(cause, "That didn't work."));
    }
  }

  const approval = approvalFor(transfer);
  const level = approval?.status === "pending" ? approval.levels[approval.currentLevel] : null;
  // Why the current user can't decide; shown instead of just hiding the buttons.
  const approvalNote = transfer.status === "pending" && !allowed("approve") ? actionBlocker(actor.id, transfer, "approve") : null;
  // The last return's comment, shown on the draft until it's resubmitted.
  const returned = transfer.status === "draft" ? [...transfer.events].reverse().find((entry) => entry.action === "returned" || entry.action === "submitted") : undefined;

  return (
    <>
      <PageHeader
        title={transfer.number}
        description={
          <span className="inline-flex items-center gap-1.5">
            {warehouseName(transfer.sourceWarehouseId)}
            <ArrowRight aria-label="to" className="size-3.5" />
            {binMove ? "another bin" : warehouseName(transfer.destinationWarehouseId)}
          </span>
        }
        actions={
          <>
            {allowed("cancel") && (
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban data-icon="inline-start" />
                Cancel transfer
              </Button>
            )}
            {allowed("edit") && (
              <LinkButton href={`/inventory/transfers/${transfer.id}/edit`} variant="outline">
                <Pencil data-icon="inline-start" />
                Edit
              </LinkButton>
            )}
            {allowed("approve") && (
              <>
                <Button variant="ghost" onClick={() => setDeciding("return")}>
                  <CornerUpLeft data-icon="inline-start" />
                  Return
                </Button>
                <Button variant="outline" onClick={() => setDeciding("reject")}>
                  <X data-icon="inline-start" />
                  Reject
                </Button>
                <Button onClick={() => setDeciding("approve")}>
                  <Check data-icon="inline-start" />
                  Approve
                </Button>
              </>
            )}
            {allowed("submit") && (
              <Button onClick={() => void run(() => submitTransfer(actor.id, transfer.id))}>
                <Send data-icon="inline-start" />
                Submit for approval
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        {level && approval && (
          <span className="text-sm text-muted-foreground">
            {approval.levels.length > 1 && `Level ${approval.currentLevel + 1} of ${approval.levels.length} · `}
            {level.name}
          </span>
        )}
        {approvalNote && <span className="text-sm text-muted-foreground">{approvalNote}</span>}
        {approval && (
          <Link href={`/approvals/${approval.id}`} className="text-sm underline-offset-4 hover:underline">
            Approval history
          </Link>
        )}
      </div>
      {returned?.action === "returned" && (
        <p className="mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          Returned for correction: “{returned.detail}”. Edit it if needed, then submit it again.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card className="pb-0">
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Item</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Dispatched</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Short</TableHead>
                  <TableHead className="pr-4 text-right">In transit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.lines.map((line) => {
                  const item = itemOf(line.variantId);
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{item?.label ?? line.variantId}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item?.variant.sku}
                          {line.sourceLocationId && ` · from ${codes.get(line.sourceLocationId) ?? line.sourceLocationId}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(line.requested)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(line.dispatched)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(line.received)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(line.damaged)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(line.short)}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{formatNumber(inTransit(line))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {allowed("dispatch") && <DispatchPanel key={`dispatch-${transfer.events.length}`} transfer={transfer} />}
          {allowed("receive") && <ReceivePanel key={`receive-${transfer.events.length}`} transfer={transfer} />}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Row label="From">{warehouseName(transfer.sourceWarehouseId)}</Row>
                <Row label="To">{warehouseName(transfer.destinationWarehouseId)}</Row>
                <Row label="Assigned to">{nameOf(transfer.assigneeId)}</Row>
                <Row label="Created by">{nameOf(transfer.createdBy)}</Row>
                <Row label="Created">{formatDateTime(transfer.createdAt)}</Row>
                {transfer.note && <Row label="Note">{transfer.note}</Row>}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Every step, who did it and when.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol aria-label="History" className="flex flex-col gap-3">
                {transfer.events.map((step, index) => (
                  <li key={index} className="border-l-2 border-border pl-3 text-sm">
                    <div className="font-medium">{eventLabels[step.action]}</div>
                    {step.detail && <div className="text-muted-foreground">{step.detail}</div>}
                    <div className="text-xs text-muted-foreground">
                      {nameOf(step.actorId)} · {formatDateTime(step.at)}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <CancelDialog open={cancelling} onOpenChange={setCancelling} onConfirm={(reason) => cancelTransfer(actor.id, transfer.id, reason)} />
      <DecisionDialog request={approval ?? null} action={deciding} onOpenChange={(open) => !open && setDeciding(null)} />
    </>
  );
}

// Cancelling (before dispatch) with an optional reason; rejecting goes through the approval decision dialog.
function CancelDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (reason: string) => Promise<void> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <CancelForm onConfirm={onConfirm} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function CancelForm({ onConfirm, onDone }: { onConfirm: (reason: string) => Promise<void>; onDone: () => void }) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Cancel transfer</DialogTitle>
        <DialogDescription>Nothing has moved yet, so no stock changes. Any open approval is withdrawn.</DialogDescription>
      </DialogHeader>
      <label htmlFor={id} className="text-sm font-medium">
        Reason
      </label>
      <Textarea id={id} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Back</DialogClose>
        <Button
          variant="destructive"
          onClick={async () => {
            try {
              await onConfirm(reason);
              onDone();
            } catch (cause) {
              setError(errorText(cause, "That didn't work."));
            }
          }}
        >
          Cancel transfer
        </Button>
      </DialogFooter>
    </>
  );
}

function DispatchPanel({ transfer }: { transfer: Transfer }) {
  const { user: actor } = useCurrentUser();
  const items = useStockItems();
  const [sent, setSent] = useState<Record<string, string>>(() => Object.fromEntries(transfer.lines.map((line) => [line.id, String(line.requested)])));
  const [error, setError] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatch</CardTitle>
        <CardDescription>Enter what actually leaves. Sending less than requested is recorded on the transfer.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {transfer.lines.map((line) => {
          const item = items.find((candidate) => candidate.variant.id === line.variantId);
          return (
            <div key={line.id} className="grid items-center gap-2 sm:grid-cols-[1fr_8rem]">
              <span className="text-sm">
                {item?.label ?? line.variantId}
                <span className="text-muted-foreground"> · {formatNumber(line.requested)} requested</span>
              </span>
              <Input
                type="number"
                min="0"
                max={line.requested}
                step="1"
                value={sent[line.id]}
                onChange={(event) => setSent((current) => ({ ...current, [line.id]: event.target.value }))}
                aria-label={`Dispatch quantity for ${item?.label ?? line.variantId}`}
              />
            </div>
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              setError("");
              try {
                await dispatchTransfer(actor.id, transfer.id, Object.fromEntries(Object.entries(sent).map(([lineId, value]) => [lineId, Number(value)])));
              } catch (cause) {
                setError(errorText(cause, "Couldn't dispatch it."));
              }
            }}
          >
            <Truck data-icon="inline-start" />
            Dispatch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ReceiptDraft = { received: string; damaged: string; short: string; locationId: string | null };

function ReceivePanel({ transfer }: { transfer: Transfer }) {
  const { user: actor } = useCurrentUser();
  const items = useStockItems();
  const open = transfer.lines.filter((line) => inTransit(line) > 0);
  const [drafts, setDrafts] = useState<Record<string, ReceiptDraft>>(() =>
    Object.fromEntries(open.map((line) => [line.id, { received: String(inTransit(line)), damaged: "0", short: "0", locationId: null }])),
  );
  const [error, setError] = useState("");
  const setDraft = (lineId: string, patch: Partial<ReceiptDraft>) => setDrafts((current) => ({ ...current, [lineId]: { ...current[lineId], ...patch } }));
  const binTracked = useWarehouses().find((warehouse) => warehouse.id === transfer.destinationWarehouseId)?.trackBins;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive</CardTitle>
        <CardDescription>
          Count what arrived. Damaged units go to the damaged balance; short units are written off as lost in transit. Anything not counted stays in transit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {open.map((line) => {
          const item = items.find((candidate) => candidate.variant.id === line.variantId);
          const name = item?.label ?? line.variantId;
          const draft = drafts[line.id];
          const field = (key: "received" | "damaged" | "short", text: string) => (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {text}
              <Input
                type="number"
                min="0"
                step="1"
                value={draft[key]}
                onChange={(event) => setDraft(line.id, { [key]: event.target.value })}
                aria-label={`${text} for ${name}`}
              />
            </label>
          );
          return (
            <div key={line.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
              <span className="text-sm">
                {name}
                <span className="text-muted-foreground"> · {formatNumber(inTransit(line))} in transit</span>
              </span>
              <div className={`grid gap-2 ${binTracked ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
                {field("received", "Received")}
                {field("damaged", "Damaged")}
                {field("short", "Short")}
                {binTracked && (
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Put in bin
                    <BinSelect
                      warehouseId={transfer.destinationWarehouseId}
                      direction="in"
                      item={item}
                      value={draft.locationId}
                      onChange={(locationId) => setDraft(line.id, { locationId })}
                      label={`Destination bin for ${name}`}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              setError("");
              const receipts: Record<string, LineReceipt> = Object.fromEntries(
                Object.entries(drafts).map(([lineId, draft]) => [
                  lineId,
                  { received: Number(draft.received), damaged: Number(draft.damaged), short: Number(draft.short), locationId: draft.locationId },
                ]),
              );
              try {
                await receiveTransfer(actor.id, transfer.id, receipts);
              } catch (cause) {
                setError(errorText(cause, "Couldn't record the receipt."));
              }
            }}
          >
            <PackageCheck data-icon="inline-start" />
            Record receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
