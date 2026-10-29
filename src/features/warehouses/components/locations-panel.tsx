"use client";

import { useState } from "react";
import Link from "next/link";
import { History, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useCategories } from "@/features/catalog/hooks/use-catalog";
import { useBinLevels } from "@/features/stock/hooks/use-warehouse-stock";
import { binUnits } from "@/features/stock/utils/stock-math";
import { formatNumber } from "@/lib/format";

import { deleteBlocker, deleteLocation } from "../api/locations-api";
import { WarehouseError } from "../api/warehouses-api";
import { useLocations, useLocationTree } from "../hooks/use-warehouses";
import type { StorageLocation, Warehouse } from "../types/warehouse";
import { locationTypeDisplay } from "../utils/location-utils";
import { LocationDialog, type LocationDialogState } from "./location-dialog";

export function LocationsPanel({ warehouse, canManage }: { warehouse: Warehouse; canManage: boolean }) {
  const { user: actor } = useCurrentUser();
  const tree = useLocationTree(warehouse.id);
  const locations = useLocations();
  const categories = useCategories();
  const bins = useBinLevels();
  const [dialog, setDialog] = useState<LocationDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ location: StorageLocation; code: string } | null>(null);
  const [error, setError] = useState("");

  const siblingsOf = (parentId: string | null) =>
    locations.filter((location) => location.warehouseId === warehouse.id && location.parentId === parentId);
  const categoryNames = (ids: string[]) =>
    ids.length === 0 ? "Any" : ids.map((id) => categories.find((category) => category.id === id)?.name ?? id).join(", ");
  const binCount = tree.filter((node) => node.location.type === "bin").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Locations</CardTitle>
        <CardDescription>
          {tree.length === 0 ? "No locations yet. Stock can't be received here until there's a bin." : `${tree.length} locations, ${binCount} bins`}
        </CardDescription>
        {canManage && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setDialog({ mode: "add", parent: null })}>
              <Plus data-icon="inline-start" />
              Add location
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {tree.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Used / capacity</TableHead>
                <TableHead>Accepts</TableHead>
                <TableHead>Status</TableHead>
                {canManage && (
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tree.map(({ location, code, depth, active }) => {
                const isBin = location.type === "bin";
                const used = isBin ? binUnits(bins, location.id) : 0;
                const full = isBin && location.capacity !== null && used >= location.capacity;
                return (
                  <TableRow key={location.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                        <span className="font-mono text-xs font-medium">{code}</span>
                        {isBin && (
                          <Link
                            href={`/inventory/movements?q=${encodeURIComponent(code)}`}
                            aria-label={`Movement history for ${code}`}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <History className="size-3.5" />
                          </Link>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{locationTypeDisplay[location.type].label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isBin ? (
                        <>
                          {formatNumber(used)}
                          <span className="text-muted-foreground"> / {location.capacity === null ? "∞" : formatNumber(location.capacity)}</span>
                          {full && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">Full</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal text-muted-foreground">{isBin ? categoryNames(location.allowedCategoryIds) : "—"}</TableCell>
                    <TableCell>
                      {active ? (
                        <StatusBadge tone="success">Active</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">{location.status === "inactive" ? "Inactive" : "Inactive via parent"}</StatusBadge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${code}`} />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isBin && (
                              <DropdownMenuItem onClick={() => setDialog({ mode: "add", parent: { location, code } })}>
                                <Plus />
                                Add inside
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setDialog({ mode: "edit", location, code })}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" disabled={deleteBlocker(location.id) !== null} onClick={() => setDeleteTarget({ location, code })}>
                              <Trash2 />
                              <span className="flex flex-col">
                                Delete
                                {deleteBlocker(location.id) && <span className="text-xs text-muted-foreground">{deleteBlocker(location.id)}</span>}
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <LocationDialog warehouse={warehouse} siblingsOf={siblingsOf} state={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.code}?`}
        description="It has never held stock, so nothing else changes."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          setError("");
          deleteLocation(actor.id, deleteTarget.location.id).catch((cause) =>
            setError(cause instanceof WarehouseError ? cause.message : "Couldn't delete the location."),
          );
        }}
      />
    </Card>
  );
}
