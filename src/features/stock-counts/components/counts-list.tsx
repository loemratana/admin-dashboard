"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { useCategories } from "@/features/catalog/hooks/use-catalog";
import { useWarehousesWhere } from "@/features/stock/hooks/use-stock-warehouses";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatDateTime, formatNumber } from "@/lib/format";

import { CountError, startCount } from "../api/counts-api";
import { countStatusDisplay, useVisibleCounts } from "../hooks/use-counts";
import { variance } from "../types/stock-count";

const selectClasses =
  "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function CountsList() {
  const counts = useVisibleCounts();
  const warehouses = useWarehouses();
  const categories = useCategories();
  const users = useUsers();
  const countable = useWarehousesWhere("inventory.count.perform", { activeOnly: true });
  const [startOpen, setStartOpen] = useState(false);

  const code = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.code ?? id;
  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="Stock counts"
        description="Count what's on the shelves and reconcile it with the system. Differences post only after someone who didn't count approves them."
        actions={
          countable.length > 0 && (
            <Button onClick={() => setStartOpen(true)}>
              <ClipboardCheck data-icon="inline-start" />
              Start count
            </Button>
          )
        }
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Count</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Counted</TableHead>
              <TableHead className="text-right">Differences</TableHead>
              <TableHead className="pr-4">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {counts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No counts yet.
                </TableCell>
              </TableRow>
            )}
            {counts.map((count) => {
              const { label, tone } = countStatusDisplay[count.status];
              const counted = count.lines.filter((line) => line.counted !== null).length;
              // Blind counts don't reveal differences until submitted.
              const differences = count.blind && count.status === "counting" ? null : count.lines.filter((line) => variance(line) !== 0).length;
              return (
                <TableRow key={count.id}>
                  <TableCell className="pl-4">
                    <Link href={`/inventory/counts/${count.id}`} className="font-mono text-xs font-medium hover:underline hover:underline-offset-4">
                      {count.number}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{code(count.warehouseId)}</TableCell>
                  <TableCell>
                    {categories.find((category) => category.id === count.categoryId)?.name ?? "All categories"}
                    {count.blind && <span className="text-xs text-muted-foreground"> · blind</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={tone}>{label}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(counted)} / {formatNumber(count.lines.length)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{differences === null ? "—" : formatNumber(differences)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {formatDateTime(count.createdAt)} · {nameOf(count.createdBy)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>{startOpen && <StartCountForm onStarted={() => setStartOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function StartCountForm({ onStarted }: { onStarted: () => void }) {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const warehouses = useWarehousesWhere("inventory.count.perform", { activeOnly: true });
  const categories = useCategories();
  const idPrefix = useId();
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [categoryId, setCategoryId] = useState("");
  const [blind, setBlind] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function start() {
    setError("");
    if (!warehouseId) return setError("Choose a warehouse.");
    try {
      const count = await startCount(actor.id, { warehouseId, categoryId: categoryId || null, blind, note });
      onStarted();
      router.push(`/inventory/counts/${count.id}`);
    } catch (cause) {
      setError(cause instanceof CountError ? cause.message : "Couldn't start the count.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Start count</DialogTitle>
        <DialogDescription>Lists what the system expects in the warehouse. Stock doesn&apos;t change until the count is posted.</DialogDescription>
      </DialogHeader>
      <FormField id={`${idPrefix}-warehouse`} label="Warehouse" required>
        <select id={`${idPrefix}-warehouse`} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={selectClasses}>
          <option value="">Choose…</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={`${idPrefix}-category`} label="Category" hint="Count one category at a time for a cycle count.">
        <select id={`${idPrefix}-category`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClasses}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </FormField>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={blind} onCheckedChange={setBlind} />
        <span>
          Blind count
          <span className="block text-xs text-muted-foreground">Counters don&apos;t see expected quantities, so they count instead of confirming.</span>
        </span>
      </label>
      <FormField id={`${idPrefix}-note`} label="Note">
        <Textarea id={`${idPrefix}-note`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button onClick={() => void start()}>Start count</Button>
      </DialogFooter>
    </>
  );
}
