"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Power, PowerOff } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthorization, useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";
import { useStockByWarehouse } from "@/features/stock/hooks/use-warehouse-stock";
import { formatCurrency, formatNumber } from "@/lib/format";

import { deactivationBlocker, setWarehouseActive, WarehouseError } from "../api/warehouses-api";
import { useVisibleWarehouses, useWarehouses } from "../hooks/use-warehouses";
import type { Warehouse } from "../types/warehouse";
import { WarehouseDialog } from "./warehouse-dialog";

export function WarehousesManager() {
  const { user: actor } = useCurrentUser();
  const canDo = useAuthorization();
  const users = useUsers();
  const allWarehouses = useWarehouses();
  const warehouses = useVisibleWarehouses();
  const [dialog, setDialog] = useState<{ open: boolean; warehouse?: Warehouse }>({ open: false });
  const [deactivateTarget, setDeactivateTarget] = useState<Warehouse | null>(null);
  const [error, setError] = useState("");

  const canManage = canDo("inventory.warehouse.manage");
  const canSeeCost = canDo("products.cost.view");
  const stock = useStockByWarehouse();
  const assignedCount = (id: string) => users.filter((user) => user.warehouseIds.includes(id)).length;

  async function setActive(warehouse: Warehouse, active: boolean) {
    setError("");
    try {
      await setWarehouseActive(actor.id, warehouse.id, active);
    } catch (cause) {
      setError(cause instanceof WarehouseError ? cause.message : "Couldn't update the warehouse.");
    }
  }

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Locations where stock is kept. Inactive ones keep their history."
        actions={
          canManage && (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus data-icon="inline-start" />
              Add warehouse
            </Button>
          )
        }
      />
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              {canSeeCost && <TableHead className="hidden text-right lg:table-cell">Value at cost</TableHead>}
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  You aren&apos;t assigned to any warehouse.
                </TableCell>
              </TableRow>
            )}
            {warehouses.map((warehouse) => {
              const active = warehouse.status === "active";
              const blocker = active ? deactivationBlocker(allWarehouses, warehouse.id) : null;
              return (
                <TableRow key={warehouse.id}>
                  <TableCell className="pl-4 font-mono text-xs font-medium">{warehouse.code}</TableCell>
                  <TableCell>
                    <Link href={`/warehouses/${warehouse.id}`} className="font-medium hover:underline hover:underline-offset-4">
                      {warehouse.name}
                    </Link>
                    {warehouse.trackBins && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">Bins</span>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{warehouse.address || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{assignedCount(warehouse.id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(stock.get(warehouse.id)?.onHand ?? 0)}</TableCell>
                  {canSeeCost && (
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatCurrency(stock.get(warehouse.id)?.value ?? 0)}</TableCell>
                  )}
                  <TableCell className="pr-4 text-right">
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${warehouse.name}`} />}
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDialog({ open: true, warehouse })}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {active ? (
                            <DropdownMenuItem
                              disabled={blocker !== null}
                              onClick={() => setDeactivateTarget(warehouse)}
                            >
                              <PowerOff />
                              <span className="flex flex-col">
                                Deactivate
                                {blocker && <span className="text-xs text-muted-foreground">{blocker}</span>}
                              </span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => void setActive(warehouse, true)}>
                              <Power />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <WarehouseDialog
        open={dialog.open}
        warehouse={dialog.warehouse}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate warehouse?"
        description={
          <>
            <span className="font-medium text-foreground">{deactivateTarget?.name}</span> won&apos;t be offered for new
            work. Its history and the {deactivateTarget ? assignedCount(deactivateTarget.id) : 0} users assigned to it are
            kept, and you can reactivate it later.
          </>
        }
        confirmLabel="Deactivate"
        onConfirm={() => deactivateTarget && void setActive(deactivateTarget, false)}
      />
    </>
  );
}
