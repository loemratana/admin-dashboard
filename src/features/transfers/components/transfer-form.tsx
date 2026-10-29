"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { FormField } from "@/components/shared/form-field";
import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { DETAILED_NOTE_MIN, matchRule } from "@/features/approvals/api/approvals-api";
import { useApprovalRules } from "@/features/approvals/hooks/use-approvals";
import { BinSelect } from "@/features/stock/components/bin-select";
import { ItemPicker } from "@/features/stock/components/item-picker";
import { useStockLevels } from "@/features/stock/hooks/use-stock";
import { useStockItems } from "@/features/stock/hooks/use-stock-items";
import { useWarehousesWhere } from "@/features/stock/hooks/use-stock-warehouses";
import { levelAt } from "@/features/stock/utils/stock-math";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatNumber } from "@/lib/format";

import { createTransfer, submitTransfer, TransferError, transferFacts, updateTransfer } from "../api/transfers-api";
import type { Transfer } from "../types/transfer";

type LineDraft = { key: number; variantId: string | null; sourceLocationId: string | null; quantity: string };

const selectClasses =
  "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

// New transfer, or (with transfer) changes to a draft, including one returned for correction.
export function TransferForm({ transfer }: { transfer?: Transfer }) {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const users = useUsers().filter((user) => user.status === "active");
  const sources = useWarehousesWhere("inventory.transfer.create", { activeOnly: true });
  const allWarehouses = useWarehouses();
  const items = useStockItems().filter((item) => item.usable);
  const levels = useStockLevels();
  const idPrefix = useId();

  useApprovalRules(); // re-render the approval preview when rules change
  const [sourceId, setSourceId] = useState(transfer?.sourceWarehouseId ?? (sources.length === 1 ? sources[0].id : ""));
  const [destinationId, setDestinationId] = useState(transfer?.destinationWarehouseId ?? "");
  const [assigneeId, setAssigneeId] = useState(transfer?.assigneeId ?? "");
  const [note, setNote] = useState(transfer?.note ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    transfer
      ? transfer.lines.map((line, index) => ({ key: index, variantId: line.variantId, sourceLocationId: line.sourceLocationId, quantity: String(line.requested) }))
      : [{ key: 0, variantId: null, sourceLocationId: null, quantity: "" }],
  );
  const [nextKey, setNextKey] = useState(transfer ? transfer.lines.length : 1);
  const [error, setError] = useState("");

  const source = allWarehouses.find((warehouse) => warehouse.id === sourceId);
  // A move inside the same warehouse only makes sense between bins.
  const destinations = allWarehouses.filter((warehouse) => warehouse.status === "active" && (warehouse.id !== sourceId || source?.trackBins));
  // Which approval rule this transfer would fall under, as it stands.
  const complete = sourceId && destinationId && lines.length > 0 && lines.every((line) => line.variantId && Number(line.quantity) > 0);
  const rule = complete
    ? matchRule("transfer", transferFacts({ sourceWarehouseId: sourceId, destinationWarehouseId: destinationId, lines: lines.map((line) => ({ variantId: line.variantId!, requested: Number(line.quantity) })) }))
    : null;
  const setLine = (key: number, patch: Partial<LineDraft>) => setLines((list) => list.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  async function save(submit: boolean) {
    setError("");
    if (!sourceId || !destinationId) return setError("Choose where the stock comes from and goes to.");
    if (lines.some((line) => !line.variantId)) return setError("Pick an item on every line, or remove empty lines.");
    const input = {
      sourceWarehouseId: sourceId,
      destinationWarehouseId: destinationId,
      assigneeId: assigneeId || null,
      note,
      lines: lines.map((line) => ({ variantId: line.variantId!, sourceLocationId: line.sourceLocationId, quantity: Number(line.quantity) })),
    };
    try {
      if (transfer) {
        await updateTransfer(actor.id, transfer.id, input);
        if (submit) await submitTransfer(actor.id, transfer.id);
        router.push(`/inventory/transfers/${transfer.id}`);
      } else {
        const created = await createTransfer(actor.id, input, submit);
        router.push(`/inventory/transfers/${created.id}`);
      }
    } catch (cause) {
      setError(cause instanceof TransferError ? cause.message : "Couldn't create the transfer.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Route</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField id={`${idPrefix}-source`} label="From" required>
            <select
              id={`${idPrefix}-source`}
              value={sourceId}
              onChange={(event) => {
                setSourceId(event.target.value);
                setDestinationId("");
                setLines((list) => list.map((line) => ({ ...line, sourceLocationId: null })));
              }}
              className={selectClasses}
            >
              <option value="">Choose…</option>
              {sources.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={`${idPrefix}-destination`} label="To" required hint={source?.trackBins ? "Choose the same warehouse to move between bins." : undefined}>
            <select id={`${idPrefix}-destination`} value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className={selectClasses} disabled={!sourceId}>
              <option value="">Choose…</option>
              {destinations.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.id === sourceId ? " (bin to bin)" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={`${idPrefix}-assignee`} label="Assigned to" hint="Who dispatches and receives it">
            <select id={`${idPrefix}-assignee`} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={selectClasses}>
              <option value="">Nobody in particular</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="sm:col-span-3">
            <FormField id={`${idPrefix}-note`} label="Note">
              <Textarea id={`${idPrefix}-note`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>What to move. Availability is checked again when it&apos;s dispatched.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const item = items.find((candidate) => candidate.variant.id === line.variantId);
            const available = item && sourceId ? levelAt(levels, item.variant.id, sourceId).available : null;
            return (
              <div key={line.key} className={`grid gap-2 sm:items-start ${source?.trackBins ? "sm:grid-cols-[1fr_14rem_7rem_auto]" : "sm:grid-cols-[1fr_7rem_auto]"}`}>
                <div>
                  <ItemPicker items={items} value={line.variantId} onChange={(variantId) => setLine(line.key, { variantId, sourceLocationId: null })} label={`Item ${index + 1}`} />
                  {available !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(available)} {item?.unit} available at the source
                    </p>
                  )}
                </div>
                {source?.trackBins && (
                  <BinSelect warehouseId={sourceId} direction="out" item={item} value={line.sourceLocationId} onChange={(sourceLocationId) => setLine(line.key, { sourceLocationId })} label={`From bin for item ${index + 1}`} />
                )}
                <Input type="number" min="1" step="1" value={line.quantity} onChange={(event) => setLine(line.key, { quantity: event.target.value })} placeholder="Qty" aria-label={`Quantity for item ${index + 1}`} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((list) => list.filter((candidate) => candidate.key !== line.key))}>
                  <X />
                </Button>
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLines((list) => [...list, { key: nextKey, variantId: null, sourceLocationId: null, quantity: "" }]);
                setNextKey((key) => key + 1);
              }}
            >
              <Plus data-icon="inline-start" />
              Add item
            </Button>
          </div>
        </CardContent>
      </Card>

      {complete && (
        <p aria-label="Approval preview" className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          {!rule
            ? "Approval: anyone who can approve transfers."
            : rule.levels.length === 0
              ? `No approval needed: “${rule.name}” lets it through once submitted.`
              : `Approval (“${rule.name}”): ${rule.levels.map((level) => level.name).join(" → ")}.`}
          {rule?.requirements.detailedNote && ` Needs a detailed note (${note.trim().length}/${DETAILED_NOTE_MIN} characters).`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <LinkButton href={transfer ? `/inventory/transfers/${transfer.id}` : "/inventory/transfers"} variant="outline">
          Cancel
        </LinkButton>
        <Button variant="outline" onClick={() => void save(false)}>
          {transfer ? "Save changes" : "Save as draft"}
        </Button>
        <Button onClick={() => void save(true)}>{transfer ? "Save and submit" : "Submit for approval"}</Button>
      </div>
    </div>
  );
}
