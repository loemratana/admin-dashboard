"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CircleCheck, Plus, X } from "lucide-react";

import { fieldA11y, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCan, useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatNumber } from "@/lib/format";

import { issueReasons, issueStock, receiveStock, StockError, type IssueInput } from "../api/stock-api";
import { useStockLevels } from "../hooks/use-stock";
import { useStockItems } from "../hooks/use-stock-items";
import { useWarehousesWhere } from "../hooks/use-stock-warehouses";
import { levelAt } from "../utils/stock-math";
import { BinSelect } from "./bin-select";
import { ItemPicker } from "./item-picker";

type Mode = "receive" | "issue";
type LineDraft = { key: number; variantId: string | null; locationId: string | null; quantity: string; unitCost: string };

const copy = {
  receive: { permission: "inventory.movement.receive", submit: "Post stock in", referenceLabel: "Supplier reference", referenceHint: "Delivery note or purchase order, e.g. PO-1044" },
  issue: { permission: "inventory.movement.issue", submit: "Post stock out", referenceLabel: "Reference", referenceHint: "Order or request number, e.g. SO-2231" },
} as const;

const selectClasses =
  "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function StockEntryForm({ mode }: { mode: Mode }) {
  const { user: actor } = useCurrentUser();
  const canSetCost = useCan("products.cost.view");
  const items = useStockItems().filter((item) => item.usable);
  const levels = useStockLevels();
  const warehouses = useWarehousesWhere(copy[mode].permission, { activeOnly: true });
  const idPrefix = useId();

  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [reference, setReference] = useState("");
  const [hold, setHold] = useState(false);
  const [reason, setReason] = useState<IssueInput["reason"] | "">("");
  const [lines, setLines] = useState<LineDraft[]>([{ key: 0, variantId: null, locationId: null, quantity: "", unitCost: "" }]);
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const itemOf = (variantId: string | null) => items.find((item) => item.variant.id === variantId);
  const tracksBins = useWarehouses().find((warehouse) => warehouse.id === warehouseId)?.trackBins ?? false;
  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((list) => list.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPosted(null);
    if (!warehouseId) return setError("Choose a warehouse.");
    if (mode === "issue" && !reason) return setError("Choose a reason.");
    if (lines.some((line) => !line.variantId)) return setError("Pick an item on every line, or remove empty lines.");
    const parsed = lines.map((line) => ({
      variantId: line.variantId!,
      locationId: line.locationId,
      quantity: Number(line.quantity),
      unitCost: line.unitCost.trim() === "" ? null : Number(line.unitCost),
    }));
    try {
      const number =
        mode === "receive"
          ? await receiveStock(actor.id, { warehouseId, reference, quarantine: hold, lines: parsed })
          : await issueStock(actor.id, { warehouseId, reason: reason as IssueInput["reason"], reference, lines: parsed });
      setPosted(number);
      setReference("");
      setHold(false);
      setReason("");
      setLines([{ key: nextKey, variantId: null, locationId: null, quantity: "", unitCost: "" }]);
      setNextKey((key) => key + 1);
      setFormKey((key) => key + 1); // resets the item pickers' typed text
    } catch (cause) {
      setError(cause instanceof StockError ? cause.message : "Couldn't post the stock movement.");
    }
  }

  if (warehouses.length === 0) {
    return <p className="text-sm text-muted-foreground">You aren&apos;t allowed to post stock in any active warehouse.</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {posted && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <CircleCheck aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
          Posted {posted}.
          <Link href={`/inventory/movements?q=${posted}`} className="font-medium underline underline-offset-4">
            View in ledger
          </Link>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField id={`${idPrefix}-warehouse`} label="Warehouse" required>
            <select id={`${idPrefix}-warehouse`} value={warehouseId} onChange={(event) => {
                // Bins belong to one warehouse; clear them when it changes.
                setWarehouseId(event.target.value);
                setLines((list) => list.map((line) => ({ ...line, locationId: null })));
              }} className={selectClasses}>
              <option value="">Choose…</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </FormField>
          {mode === "issue" && (
            <FormField id={`${idPrefix}-reason`} label="Reason" required>
              <select
                id={`${idPrefix}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value as IssueInput["reason"])}
                className={selectClasses}
              >
                <option value="">Choose…</option>
                {issueReasons.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField id={`${idPrefix}-reference`} label={copy[mode].referenceLabel} hint={copy[mode].referenceHint}>
            <Input {...fieldA11y(`${idPrefix}-reference`, undefined, true)} value={reference} onChange={(event) => setReference(event.target.value)} />
          </FormField>
          {mode === "receive" && (
            <label className="flex items-start gap-2 text-sm sm:col-span-3">
              <Checkbox className="mt-0.5" checked={hold} onCheckedChange={setHold} />
              <span>
                Hold for inspection
                <span className="block text-xs text-muted-foreground">
                  The stock goes into quarantine and can&apos;t be issued until it&apos;s released with an adjustment.
                </span>
              </span>
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {mode === "receive" ? "What arrived. Unit cost defaults to the product's cost." : "What's leaving. You can't issue more than is available."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3" key={formKey}>
          {lines.map((line, index) => {
            const item = itemOf(line.variantId);
            const available = item && warehouseId ? levelAt(levels, item.variant.id, warehouseId).available : null;
            return (
              <div key={line.key} className={`grid gap-2 sm:items-start ${tracksBins ? "sm:grid-cols-[1fr_14rem_7rem_8rem_auto]" : "sm:grid-cols-[1fr_7rem_8rem_auto]"}`}>
                <div>
                  <ItemPicker items={items} value={line.variantId} onChange={(variantId) => setLine(line.key, { variantId, locationId: null })} label={`Item ${index + 1}`} />
                  {available !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(available)} {item?.unit} available here
                    </p>
                  )}
                </div>
                {tracksBins && (
                  <BinSelect
                    warehouseId={warehouseId}
                    direction={mode === "receive" ? "in" : "out"}
                    item={item}
                    value={line.locationId}
                    onChange={(locationId) => setLine(line.key, { locationId })}
                    label={`Bin for item ${index + 1}`}
                  />
                )}
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                  placeholder="Qty"
                  aria-label={`Quantity for item ${index + 1}`}
                />
                {mode === "receive" && canSetCost ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) => setLine(line.key, { unitCost: event.target.value })}
                    placeholder={item ? item.unitCost.toFixed(2) : "Unit cost"}
                    aria-label={`Unit cost for item ${index + 1}`}
                  />
                ) : (
                  <span className="hidden sm:block" />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((list) => list.filter((candidate) => candidate.key !== line.key))}
                >
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
                setLines((list) => [...list, { key: nextKey, variantId: null, locationId: null, quantity: "", unitCost: "" }]);
                setNextKey((key) => key + 1);
              }}
            >
              <Plus data-icon="inline-start" />
              Add item
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit">{copy[mode].submit}</Button>
      </div>
    </form>
  );
}
