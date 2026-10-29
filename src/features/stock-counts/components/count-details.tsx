"use client";

import { useId, useMemo, useState } from "react";
import { Ban, CheckCheck, History, Plus, RotateCcw, Send } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCan, useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { useCategories } from "@/features/catalog/hooks/use-catalog";
import { BinSelect } from "@/features/stock/components/bin-select";
import { ItemPicker } from "@/features/stock/components/item-picker";
import { useMovements } from "@/features/stock/hooks/use-stock";
import { useStockItems } from "@/features/stock/hooks/use-stock-items";
import { useLocationCodes, useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { useStore } from "@/lib/create-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

import {
  actionBlocker,
  addCountLine,
  cancelCount,
  canViewCount,
  CountError,
  countsStore,
  movedDuringCount,
  postCount,
  recordCounts,
  requestRecount,
  showsExpected,
  submitCount,
  type CountAction,
} from "../api/counts-api";
import { countStatusDisplay } from "../hooks/use-counts";
import { variance, type CountEvent, type StockCount } from "../types/stock-count";

const eventLabels: Record<CountEvent["action"], string> = {
  started: "Started",
  counted: "Counted",
  submitted: "Submitted for review",
  recount: "Sent for recount",
  posted: "Posted",
  cancelled: "Cancelled",
};

const errorText = (cause: unknown, fallback: string) => (cause instanceof CountError ? cause.message : fallback);
const signed = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value));
const differenceClass = (value: number) => (value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground");

export function CountDetails({ countId }: { countId: string }) {
  const count = useStore(countsStore).find((candidate) => candidate.id === countId);
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const warehouses = useWarehouses();
  const categories = useCategories();
  const items = useStockItems();
  const codes = useLocationCodes();
  const movements = useMovements();
  const canSeeCost = useCan("products.cost.view");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [reasonFor, setReasonFor] = useState<"recount" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useBreadcrumbLabel(`/inventory/counts/${countId}`, count?.number);

  // Recomputed when the ledger changes, so the flags stay current.
  const moved = useMemo(() => (count && count.status === "review" ? movedDuringCount(count) : new Set<string>()), [count, movements]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!count || !canViewCount(actor.id, count)) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Count not found</h1>
        <LinkButton href="/inventory/counts" variant="outline" className="mt-2">
          Back to stock counts
        </LinkButton>
      </div>
    );
  }

  const warehouse = warehouses.find((candidate) => candidate.id === count.warehouseId);
  const allowed = (action: CountAction) => actionBlocker(actor.id, count, action) === null;
  const canCount = allowed("count");
  const canReview = allowed("recount");
  const expectedVisible = showsExpected(count);
  const nameOf = (id: string | null) => users.find((user) => user.id === id)?.name ?? "—";
  const itemOf = (variantId: string) => items.find((item) => item.variant.id === variantId);
  const { label, tone } = countStatusDisplay[count.status];

  const query = search.trim().toLowerCase();
  const lines = count.lines.filter((line) => {
    if (!query) return true;
    const item = itemOf(line.variantId);
    return [item?.label, item?.variant.sku, item?.variant.barcode, line.locationId && codes.get(line.locationId)].some((value) => value?.toLowerCase().includes(query));
  });

  const counted = count.lines.filter((line) => line.counted !== null).length;
  const differing = count.lines.filter((line) => variance(line) !== 0);
  const over = differing.reduce((sum, line) => sum + Math.max(variance(line), 0), 0);
  const short = differing.reduce((sum, line) => sum + Math.max(-variance(line), 0), 0);
  const value = differing.reduce((sum, line) => sum + variance(line) * (itemOf(line.variantId)?.unitCost ?? 0), 0);
  const summary = [
    { label: "Counted", value: `${formatNumber(counted)} / ${formatNumber(count.lines.length)}` },
    ...(expectedVisible
      ? [
          { label: "Matching", value: formatNumber(counted - differing.length) },
          { label: "Over", value: `+${formatNumber(over)}` },
          { label: "Short", value: `-${formatNumber(short)}` },
          ...(canSeeCost ? [{ label: "Net value", value: formatCurrency(value) }] : []),
        ]
      : []),
  ];

  async function run(action: () => Promise<void>, done = "") {
    setError("");
    setSaved("");
    try {
      await action();
      setSaved(done);
    } catch (cause) {
      setError(errorText(cause, "That didn't work."));
    }
  }

  async function saveCounts() {
    const changed: Record<string, number> = {};
    for (const [lineId, text] of Object.entries(drafts)) {
      if (text.trim() === "") continue;
      changed[lineId] = Number(text);
    }
    if (Object.keys(changed).length === 0) return setError("Enter at least one quantity.");
    await run(async () => {
      await recordCounts(actor.id, count!.id, changed);
      setDrafts({});
    }, `Saved ${Object.keys(changed).length} ${Object.keys(changed).length === 1 ? "line" : "lines"}.`);
  }

  const postNote = count.status === "review" && canReview && !allowed("post") ? actionBlocker(actor.id, count, "post") : null;
  const submitNote = count.status === "counting" && canCount && !allowed("submit") ? actionBlocker(actor.id, count, "submit") : null;

  return (
    <>
      <PageHeader
        title={count.number}
        description={[warehouse?.name, categories.find((category) => category.id === count.categoryId)?.name ?? "All categories", count.blind && "Blind count"].filter(Boolean).join(" · ")}
        actions={
          <>
            {allowed("cancel") && (
              <Button variant="outline" onClick={() => setReasonFor("cancel")}>
                <Ban data-icon="inline-start" />
                Cancel count
              </Button>
            )}
            {canReview && (
              <Button variant="outline" disabled={selected.size === 0} onClick={() => setReasonFor("recount")}>
                <RotateCcw data-icon="inline-start" />
                Recount selected{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            )}
            {allowed("post") && (
              <Button onClick={() => void run(() => postCount(actor.id, count.id), "Posted. Stock now matches the count.")}>
                <CheckCheck data-icon="inline-start" />
                Post differences
              </Button>
            )}
            {canCount && (
              <Button disabled={!allowed("submit")} onClick={() => void run(() => submitCount(actor.id, count.id))}>
                <Send data-icon="inline-start" />
                Submit for review
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        {(postNote || submitNote) && <span className="text-sm text-muted-foreground">{postNote ?? submitNote}</span>}
        {count.status === "posted" && (
          <LinkButton href={`/inventory/movements?q=${count.number}`} variant="ghost" size="sm">
            <History data-icon="inline-start" />
            Posted movements
          </LinkButton>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">
          {saved}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {summary.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card className="pb-0">
            <CardHeader>
              <CardTitle>Lines</CardTitle>
              <CardDescription>
                Count good stock only (available and reserved). Damaged and quarantined units are kept apart.
                {count.status === "review" && " Lines marked “Stock moved” changed in the system during the count; check them before posting."}
              </CardDescription>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, SKU, barcode or bin…" aria-label="Search lines" className="mt-2 sm:max-w-xs" />
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canReview && <TableHead className="w-8 pl-4"><span className="sr-only">Select</span></TableHead>}
                    <TableHead className={canReview ? "" : "pl-4"}>Item</TableHead>
                    {expectedVisible && <TableHead className="text-right">Expected</TableHead>}
                    <TableHead className="text-right">Counted</TableHead>
                    {expectedVisible && <TableHead className="text-right">Difference</TableHead>}
                    {expectedVisible && canSeeCost && <TableHead className="text-right">Value</TableHead>}
                    <TableHead className="pr-4">Counted by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Nothing to count.
                      </TableCell>
                    </TableRow>
                  )}
                  {lines.map((line) => {
                    const item = itemOf(line.variantId);
                    const name = item?.label ?? line.variantId;
                    const difference = variance(line);
                    return (
                      <TableRow key={line.id}>
                        {canReview && (
                          <TableCell className="pl-4">
                            <Checkbox
                              aria-label={`Recount ${name}`}
                              checked={selected.has(line.id)}
                              onCheckedChange={(checked) =>
                                setSelected((current) => {
                                  const next = new Set(current);
                                  if (checked) next.add(line.id);
                                  else next.delete(line.id);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                        )}
                        <TableCell className={`whitespace-normal ${canReview ? "" : "pl-4"}`}>
                          <div className="font-medium">{name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {item?.variant.sku}
                            {line.locationId && ` · ${codes.get(line.locationId) ?? line.locationId}`}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {line.recount && <StatusBadge tone="warning">Recount</StatusBadge>}
                            {line.added && <StatusBadge tone="info">Added</StatusBadge>}
                            {moved.has(line.id) && <StatusBadge tone="danger">Stock moved</StatusBadge>}
                          </div>
                        </TableCell>
                        {expectedVisible && <TableCell className="text-right tabular-nums">{formatNumber(line.expected)}</TableCell>}
                        <TableCell className="text-right tabular-nums">
                          {canCount ? (
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={drafts[line.id] ?? (line.counted === null ? "" : String(line.counted))}
                              onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: event.target.value }))}
                              aria-label={`Counted quantity for ${name}${line.locationId ? ` in ${codes.get(line.locationId)}` : ""}`}
                              className="ml-auto w-24 text-right"
                            />
                          ) : line.counted === null ? (
                            "—"
                          ) : (
                            formatNumber(line.counted)
                          )}
                        </TableCell>
                        {expectedVisible && (
                          <TableCell className={`text-right tabular-nums ${differenceClass(difference)}`}>{line.counted === null ? "—" : signed(difference)}</TableCell>
                        )}
                        {expectedVisible && canSeeCost && (
                          <TableCell className={`text-right tabular-nums ${differenceClass(difference)}`}>
                            {line.counted === null || difference === 0 ? "—" : formatCurrency(difference * (item?.unitCost ?? 0))}
                          </TableCell>
                        )}
                        <TableCell className="pr-4 text-muted-foreground">{nameOf(line.countedBy)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {canCount && (
              <div className="flex justify-end border-t border-border p-4">
                <Button onClick={() => void saveCounts()}>Save counts</Button>
              </div>
            )}
          </Card>

          {canCount && <AddLineCard count={count} />}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Every step, who did it and when.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol aria-label="History" className="flex flex-col gap-3">
                {count.events.map((step, index) => (
                  <li key={index} className="border-l-2 border-border pl-3 text-sm">
                    <div className="font-medium">{eventLabels[step.action]}</div>
                    {step.detail && <div className="text-muted-foreground">{step.detail}</div>}
                    <div className="text-xs text-muted-foreground">
                      {nameOf(step.actorId)} · {formatDateTime(step.at)}
                    </div>
                  </li>
                ))}
              </ol>
              {count.note && <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">Note: {count.note}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <ReasonDialog
        mode={reasonFor}
        onOpenChange={(open) => !open && setReasonFor(null)}
        onConfirm={async (reason) => {
          if (reasonFor === "recount") {
            await requestRecount(actor.id, count.id, [...selected], reason);
            setSelected(new Set());
          } else {
            await cancelCount(actor.id, count.id, reason);
          }
        }}
      />
    </>
  );
}

function AddLineCard({ count }: { count: StockCount }) {
  const { user: actor } = useCurrentUser();
  const items = useStockItems().filter((item) => !count.categoryId || item.product.categoryId === count.categoryId);
  const binTracked = useWarehouses().find((warehouse) => warehouse.id === count.warehouseId)?.trackBins;
  const [variantId, setVariantId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const item = items.find((candidate) => candidate.variant.id === variantId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Found something else?</CardTitle>
        <CardDescription>Add an item that isn&apos;t on the list{binTracked ? ", or one found in a different bin" : ""}, then count it above.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className={`grid gap-2 sm:items-start ${binTracked ? "sm:grid-cols-[1fr_14rem_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
          <ItemPicker items={items} value={variantId} onChange={(id) => setVariantId(id)} label="Found item" />
          {binTracked && <BinSelect warehouseId={count.warehouseId} direction="in" item={item} value={locationId} onChange={setLocationId} label="Found in bin" />}
          <Button
            variant="outline"
            onClick={async () => {
              setError("");
              if (!variantId) return setError("Choose an item.");
              try {
                await addCountLine(actor.id, count.id, { variantId, locationId });
                setVariantId(null);
                setLocationId(null);
              } catch (cause) {
                setError(errorText(cause, "Couldn't add it."));
              }
            }}
          >
            <Plus data-icon="inline-start" />
            Add line
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReasonDialog({
  mode,
  onOpenChange,
  onConfirm,
}: {
  mode: "recount" | "cancel" | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent>{mode && <ReasonForm mode={mode} onConfirm={onConfirm} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function ReasonForm({ mode, onConfirm, onDone }: { mode: "recount" | "cancel"; onConfirm: (reason: string) => Promise<void>; onDone: () => void }) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === "recount" ? "Send for recount" : "Cancel count"}</DialogTitle>
        <DialogDescription>
          {mode === "recount" ? "The selected lines are cleared and go back to the counters." : "Nothing has been posted, so no stock changes."}
        </DialogDescription>
      </DialogHeader>
      <label htmlFor={id} className="text-sm font-medium">
        Reason{mode === "recount" && " (required)"}
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
          variant={mode === "cancel" ? "destructive" : "default"}
          onClick={async () => {
            try {
              await onConfirm(reason);
              onDone();
            } catch (cause) {
              setError(errorText(cause, "That didn't work."));
            }
          }}
        >
          {mode === "recount" ? "Send for recount" : "Cancel count"}
        </Button>
      </DialogFooter>
    </>
  );
}
