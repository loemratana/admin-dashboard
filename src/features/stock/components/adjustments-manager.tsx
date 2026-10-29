"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CornerUpLeft, Paperclip, Plus, X } from "lucide-react";

import { fieldA11y, FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { decisionBlocker, DETAILED_NOTE_MIN, requestsStore } from "@/features/approvals/api/approvals-api";
import { DocumentPicker, type PickedDocument } from "@/features/approvals/components/document-picker";
import { DecisionDialog, type DecisionAction } from "@/features/approvals/components/decision-dialog";
import type { ApprovalRequest } from "@/features/approvals/types/approval";
import { useStore } from "@/lib/create-store";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatDateTime, formatNumber } from "@/lib/format";

import { adjustmentRequirements, countReasons, requestAdjustment, resubmitAdjustment, StockError, systemBucket, type DocumentInput } from "../api/stock-api";
import { useAdjustments, useStockLevels } from "../hooks/use-stock";
import { useBinLevels } from "../hooks/use-warehouse-stock";
import { useStockItems } from "../hooks/use-stock-items";
import { useWarehousesWhere } from "../hooks/use-stock-warehouses";
import type { AdjustmentReason, AdjustmentRequest, AdjustmentStatus } from "../types/stock";
import { adjustmentEffects, adjustmentSource, binLevel, levelAt } from "../utils/stock-math";
import { BinSelect } from "./bin-select";
import { ItemPicker } from "./item-picker";

const statusDisplay: Record<AdjustmentStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "neutral" },
  returned: { label: "Returned", tone: "info" },
};

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function AdjustmentsManager() {
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const adjustments = useAdjustments();
  const items = useStockItems();
  const allWarehouses = useWarehouses();
  const visible = useWarehousesWhere("inventory.stock.view");
  const requestable = useWarehousesWhere("inventory.adjustment.request", { activeOnly: true });
  const [status, setStatus] = useState<AdjustmentStatus | "all">("pending");
  const [requestOpen, setRequestOpen] = useState(false);
  const approvals = useStore(requestsStore);
  const [deciding, setDeciding] = useState<{ approval: ApprovalRequest; action: DecisionAction } | null>(null);
  const [resubmitting, setResubmitting] = useState<AdjustmentRequest | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const nameOf = (id: string | null) => users.find((user) => user.id === id)?.name ?? "—";
  const itemLabel = (variantId: string) => items.find((item) => item.variant.id === variantId)?.label ?? "Removed item";
  const warehouseCode = (id: string) => allWarehouses.find((warehouse) => warehouse.id === id)?.code ?? id;

  const rows = useMemo(() => {
    const visibleIds = new Set(visible.map((warehouse) => warehouse.id));
    return adjustments
      .filter((request) => visibleIds.has(request.warehouseId) && (status === "all" || request.status === status))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [adjustments, visible, status]);

  // The approval request behind each adjustment (the latest, if resubmitted).
  const approvalFor = (requestId: string) => approvals.filter((approval) => approval.kind === "adjustment" && approval.subjectId === requestId).at(-1);

  return (
    <>
      <PageHeader
        title="Adjustments"
        description="Corrections to stock with a reason. Approval rules decide who approves each request; stock changes only after the final approval."
        actions={
          requestable.length > 0 && (
            <Button onClick={() => setRequestOpen(true)}>
              <Plus data-icon="inline-start" />
              Request adjustment
            </Button>
          )
        }
      />
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mb-3 text-sm ${message.tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
        >
          {message.text}
        </p>
      )}
      <div className="mb-3">
        <select value={status} onChange={(event) => setStatus(event.target.value as AdjustmentStatus | "all")} aria-label="Status" className={selectClasses}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="returned">Returned</option>
          <option value="all">All</option>
        </select>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Request</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {status === "pending" ? "Nothing waiting for approval." : "No adjustments."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((request) => {
              const approval = approvalFor(request.id);
              const canDecide = approval !== undefined && decisionBlocker(actor.id, approval) === null;
              const level = approval?.levels[approval.currentLevel];
              const { label, tone } = statusDisplay[request.status];
              return (
                <TableRow key={request.id}>
                  <TableCell className="pl-4">
                    <p className="font-mono text-xs font-medium">{request.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(request.requestedAt)} · {warehouseCode(request.warehouseId)}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal">
                    <p className="font-medium">{itemLabel(request.variantId)}</p>
                    <p className="text-xs text-muted-foreground">{request.note}</p>
                    {request.documents.length > 0 && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        <Paperclip className="size-3 text-muted-foreground" aria-hidden />
                        {request.documents.map((document) => (
                          <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                            {document.name}
                          </a>
                        ))}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">{adjustmentEffects[request.reason].label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{request.variance > 0 ? `+${formatNumber(request.variance)}` : formatNumber(request.variance)}</span>
                    <p className="text-xs whitespace-nowrap text-muted-foreground">
                      system {formatNumber(request.systemQuantity)}
                      {request.countedQuantity !== null && ` · counted ${formatNumber(request.countedQuantity)}`}
                    </p>
                  </TableCell>
                  <TableCell>{nameOf(request.requestedBy)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={tone}>{label}</StatusBadge>
                    {request.decidedBy && <p className="mt-1 text-xs text-muted-foreground">by {nameOf(request.decidedBy)}</p>}
                    {request.status === "pending" && approval && level && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {approval.levels.length > 1 && `Level ${approval.currentLevel + 1} of ${approval.levels.length} · `}
                        {level.name}
                      </p>
                    )}
                    {request.status === "returned" && request.decisionNote && <p className="mt-1 max-w-48 text-xs whitespace-normal text-muted-foreground">“{request.decisionNote}”</p>}
                    {approval && (
                      <Link href={`/approvals/${approval.id}`} className="mt-1 block text-xs underline-offset-4 hover:underline">
                        Approval history
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {request.status === "pending" &&
                      approval &&
                      (!canDecide ? (
                        <span className="text-xs text-muted-foreground">
                          {request.requestedBy === actor.id ? "Your request — needs someone else" : "Waiting for an approver"}
                        </span>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" aria-label={`Return ${request.number}`} onClick={() => setDeciding({ approval, action: "return" })}>
                            <CornerUpLeft data-icon="inline-start" />
                            Return
                          </Button>
                          <Button size="sm" variant="outline" aria-label={`Reject ${request.number}`} onClick={() => setDeciding({ approval, action: "reject" })}>
                            <X data-icon="inline-start" />
                            Reject
                          </Button>
                          <Button size="sm" aria-label={`Approve ${request.number}`} onClick={() => setDeciding({ approval, action: "approve" })}>
                            <Check data-icon="inline-start" />
                            Approve
                          </Button>
                        </div>
                      ))}
                    {request.status === "returned" && request.requestedBy === actor.id && (
                      <Button size="sm" variant="outline" onClick={() => setResubmitting(request)}>
                        Correct and resubmit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <RequestAdjustmentDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onRequested={(request) => setMessage({ tone: "info", text: `${request.number} requested. It needs approval before stock changes.` })}
      />

      <DecisionDialog
        request={deciding?.approval ?? null}
        action={deciding?.action ?? null}
        onOpenChange={(open) => !open && setDeciding(null)}
        onDecided={(approval, action) =>
          setMessage({
            tone: "info",
            text:
              action === "approve"
                ? approval.status === "approved"
                  ? `${approval.reference} approved and posted.`
                  : `${approval.reference}: approved at this level, now waiting for ${approval.levels[approval.currentLevel].name}.`
                : `${approval.reference} ${action === "reject" ? "rejected" : "returned to the requester"}.`,
          })
        }
      />

      <Dialog open={resubmitting !== null} onOpenChange={(open) => !open && setResubmitting(null)}>
        <DialogContent>
          {resubmitting && (
            <ResubmitForm
              request={resubmitting}
              itemLabel={itemLabel(resubmitting.variantId)}
              onDone={() => {
                setMessage({ tone: "info", text: `${resubmitting.number} resubmitted for approval.` });
                setResubmitting(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// The system quantity an adjustment is measured against, live from the ledger.
function useSystemQuantity(reason: AdjustmentReason | "", variantId: string | null, warehouseId: string, locationId: string | null) {
  const levels = useStockLevels();
  const bins = useBinLevels();
  if (!reason || !variantId || !warehouseId) return null;
  const bucket = systemBucket(reason);
  return { bucket, quantity: (locationId ? binLevel(bins, locationId, variantId) : levelAt(levels, variantId, warehouseId))[bucket] };
}

// Quantity, or a shelf count it's worked out from, plus system quantity and variance.
function MeasureFields({
  reason,
  system,
  quantity,
  onQuantity,
  counted,
  onCounted,
}: {
  reason: AdjustmentReason | "";
  system: { bucket: string; quantity: number } | null;
  quantity: string;
  onQuantity: (value: string) => void;
  counted: string;
  onCounted: (value: string) => void;
}) {
  const idPrefix = useId();
  const countable = reason !== "" && countReasons.includes(reason);
  const fromCount = countable && counted.trim() !== "" && system !== null;
  const variance = fromCount ? Number(counted) - system.quantity : reason && quantity ? (adjustmentSource(reason) === null ? 1 : -1) * Number(quantity) : null;

  return (
    <div className="grid gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        {countable && (
          <FormField id={`${idPrefix}-counted`} label="Counted on the shelf" hint="Optional. Sets the quantity from the difference.">
            <Input {...fieldA11y(`${idPrefix}-counted`)} type="number" min="0" step="1" value={counted} onChange={(event) => onCounted(event.target.value)} className="w-32" />
          </FormField>
        )}
        <FormField id={`${idPrefix}-quantity`} label="Quantity" required>
          <Input
            {...fieldA11y(`${idPrefix}-quantity`)}
            type="number"
            min="1"
            step="1"
            value={fromCount ? String(Math.abs(Number(counted) - system.quantity)) : quantity}
            onChange={(event) => onQuantity(event.target.value)}
            disabled={fromCount}
            className="w-32"
          />
        </FormField>
      </div>
      {system && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          System quantity ({system.bucket}): <span className="font-medium text-foreground tabular-nums">{formatNumber(system.quantity)}</span>
          {variance !== null && Number.isFinite(variance) && (
            <>
              {" "}
              · Variance: <span className="font-medium text-foreground tabular-nums">{variance > 0 ? `+${variance}` : variance}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// What the matching approval rule asks for, shown before submitting.
function EvidenceNotice({ requirements, note }: { requirements: { ruleName: string; requirements: { documents: number; detailedNote: boolean } } | null; note: string }) {
  if (!requirements) return null;
  const { documents, detailedNote } = requirements.requirements;
  if (documents === 0 && !detailedNote) return null;
  const needs = [
    detailedNote && `a detailed note (${note.trim().length}/${DETAILED_NOTE_MIN} characters)`,
    documents > 0 && (documents === 1 ? "1 supporting document" : `${documents} supporting documents`),
  ].filter(Boolean);
  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Sensitive adjustment (“{requirements.ruleName}”): needs {needs.join(" and ")}.
    </p>
  );
}

const countedOrNull = (reason: AdjustmentReason | "", counted: string) => (reason && countReasons.includes(reason) && counted.trim() !== "" ? Number(counted) : null);

function ResubmitForm({ request, itemLabel, onDone }: { request: AdjustmentRequest; itemLabel: string; onDone: () => void }) {
  const { user: actor } = useCurrentUser();
  const idPrefix = useId();
  const [quantity, setQuantity] = useState(String(request.quantity));
  const [counted, setCounted] = useState(request.countedQuantity === null ? "" : String(request.countedQuantity));
  const [note, setNote] = useState(request.note);
  const [documents, setDocuments] = useState<PickedDocument[]>(request.documents);
  const [error, setError] = useState("");
  const system = useSystemQuantity(request.reason, request.variantId, request.warehouseId, request.locationId);
  const countedQuantity = countedOrNull(request.reason, counted);
  const effective = countedQuantity !== null && system ? Math.abs(countedQuantity - system.quantity) : Number(quantity);
  const requirements = effective > 0 ? adjustmentRequirements({ warehouseId: request.warehouseId, variantId: request.variantId, reason: request.reason, quantity: effective }) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await resubmitAdjustment(actor.id, request.id, { quantity: Number(quantity), countedQuantity, note, documents });
      onDone();
    } catch (cause) {
      setError(cause instanceof StockError ? cause.message : "Couldn't resubmit it.");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Correct {request.number}</DialogTitle>
        <DialogDescription>
          {adjustmentEffects[request.reason].label} · {itemLabel}. Returned with: “{request.decisionNote}”
        </DialogDescription>
      </DialogHeader>
      <MeasureFields reason={request.reason} system={system} quantity={quantity} onQuantity={setQuantity} counted={counted} onCounted={setCounted} />
      <FormField id={`${idPrefix}-note`} label="What happened" required>
        <Textarea {...fieldA11y(`${idPrefix}-note`)} value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </FormField>
      <DocumentPicker value={documents} onChange={setDocuments} />
      <EvidenceNotice requirements={requirements} note={note} />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Resubmit</Button>
      </DialogFooter>
    </form>
  );
}

function RequestAdjustmentDialog({
  open,
  onOpenChange,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (request: AdjustmentRequest) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">{open && <RequestForm onDone={(request) => { onRequested(request); onOpenChange(false); }} />}</DialogContent>
    </Dialog>
  );
}

function RequestForm({ onDone }: { onDone: (request: AdjustmentRequest) => void }) {
  const { user: actor } = useCurrentUser();
  const items = useStockItems().filter((item) => item.usable);
  const levels = useStockLevels();
  const warehouses = useWarehousesWhere("inventory.adjustment.request", { activeOnly: true });
  const idPrefix = useId();
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [reason, setReason] = useState<AdjustmentReason | "">("");
  const [quantity, setQuantity] = useState("");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [documents, setDocuments] = useState<PickedDocument[]>([]);
  const [error, setError] = useState("");

  const level = variantId && warehouseId ? levelAt(levels, variantId, warehouseId) : null;
  const system = useSystemQuantity(reason, variantId, warehouseId, locationId);
  const countedQuantity = countedOrNull(reason, counted);
  const effective = countedQuantity !== null && system ? Math.abs(countedQuantity - system.quantity) : Number(quantity);
  const requirements = reason && variantId && warehouseId && effective > 0 ? adjustmentRequirements({ warehouseId, variantId, reason, quantity: effective }) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!warehouseId || !variantId || !reason) return setError("Choose a warehouse, an item and a reason.");
    try {
      const request = await requestAdjustment(actor.id, { warehouseId, locationId, variantId, reason, quantity: Number(quantity), countedQuantity, note, documents: documents as DocumentInput[] });
      onDone(request);
    } catch (cause) {
      setError(cause instanceof StockError ? cause.message : "Couldn't create the request.");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Request adjustment</DialogTitle>
        <DialogDescription>Stock changes only after it&apos;s approved. Larger or riskier adjustments may need more than one approver.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-warehouse`} label="Warehouse" required>
          <select id={`${idPrefix}-warehouse`} value={warehouseId} onChange={(event) => {
              setWarehouseId(event.target.value);
              setLocationId(null);
            }} className={`w-full ${selectClasses}`}>
            <option value="">Choose…</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={`${idPrefix}-reason`} label="Reason" required>
          <select
            id={`${idPrefix}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as AdjustmentReason)}
            className={`w-full ${selectClasses}`}
          >
            <option value="">Choose…</option>
            {Object.entries(adjustmentEffects).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Item</span>
        <ItemPicker items={items} value={variantId} onChange={(next) => { setVariantId(next); setLocationId(null); }} label="Item" />
        {warehouseId && (
          <BinSelect
            warehouseId={warehouseId}
            // Adding stock places it in a bin; everything else takes from a bin that holds it.
            direction={reason && adjustmentSource(reason) === null ? "in" : "out"}
            sourceBucket={(reason && adjustmentSource(reason)) || "available"}
            item={items.find((item) => item.variant.id === variantId)}
            value={locationId}
            onChange={setLocationId}
            label="Bin"
          />
        )}
        {level && (
          <p className="text-xs text-muted-foreground">
            Here now: {formatNumber(level.available)} available · {formatNumber(level.reserved)} reserved · {formatNumber(level.damaged)} damaged · {formatNumber(level.quarantined)} quarantined
          </p>
        )}
      </div>
      <MeasureFields reason={reason} system={system} quantity={quantity} onQuantity={setQuantity} counted={counted} onCounted={setCounted} />
      <FormField id={`${idPrefix}-note`} label="What happened" required>
        <Textarea {...fieldA11y(`${idPrefix}-note`)} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      </FormField>
      <DocumentPicker value={documents} onChange={setDocuments} />
      <EvidenceNotice requirements={requirements} note={note} />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Submit request</Button>
      </DialogFooter>
    </form>
  );
}
