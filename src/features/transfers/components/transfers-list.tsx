"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan, useUsers } from "@/features/access-control/hooks/use-access";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatDateTime, formatNumber } from "@/lib/format";

import { openStatuses, transferStatusDisplay, useVisibleTransfers } from "../hooks/use-transfers";
import type { TransferStatus } from "../types/transfer";

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function TransfersList() {
  const transfers = useVisibleTransfers();
  const warehouses = useWarehouses();
  const users = useUsers();
  const canCreate = useCan("inventory.transfer.create");
  const [filter, setFilter] = useState<TransferStatus | "open" | "all">("open");

  const code = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.code ?? id;
  const nameOf = (id: string | null) => users.find((user) => user.id === id)?.name ?? "—";
  const rows = transfers.filter((transfer) =>
    filter === "all" ? true : filter === "open" ? openStatuses.includes(transfer.status) : transfer.status === filter,
  );

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Move stock between warehouses or bins. Every transfer is approved by someone other than its creator."
        actions={
          canCreate && (
            <LinkButton href="/inventory/transfers/new">
              <Plus data-icon="inline-start" />
              New transfer
            </LinkButton>
          )
        }
      />
      <div className="mb-3">
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Status" className={selectClasses}>
          <option value="open">Open</option>
          <option value="all">All</option>
          {Object.entries(transferStatusDisplay).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Transfer</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead className="pr-4">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No transfers.
                </TableCell>
              </TableRow>
            )}
            {rows.map((transfer) => {
              const { label, tone } = transferStatusDisplay[transfer.status];
              const units = transfer.lines.reduce((sum, line) => sum + line.requested, 0);
              return (
                <TableRow key={transfer.id}>
                  <TableCell className="pl-4">
                    <Link href={`/inventory/transfers/${transfer.id}`} className="font-mono text-xs font-medium hover:underline hover:underline-offset-4">
                      {transfer.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      {code(transfer.sourceWarehouseId)}
                      <ArrowRight aria-label="to" className="size-3.5 text-muted-foreground" />
                      {code(transfer.destinationWarehouseId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={tone}>{label}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(units)}
                    <span className="text-xs text-muted-foreground"> · {transfer.lines.length} items</span>
                  </TableCell>
                  <TableCell>{nameOf(transfer.assigneeId)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {formatDateTime(transfer.createdAt)} · {nameOf(transfer.createdBy)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
