"use client";

import { useState } from "react";
import { Pencil, UserMinus, UserPlus } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessError, setWarehouseAssignment } from "@/features/access-control/api/access-api";
import { useAuthorization, useCurrentUser, useRoles, useUsers } from "@/features/access-control/hooks/use-access";
import { canManageUsers } from "@/features/access-control/policies/user-policy";
import { useStockByWarehouse } from "@/features/stock/hooks/use-warehouse-stock";
import { formatCurrency, formatNumber } from "@/lib/format";

import { useWarehouses } from "../hooks/use-warehouses";
import type { Warehouse } from "../types/warehouse";
import { weekdays } from "../utils/location-utils";
import { LocationsPanel } from "./locations-panel";
import { WarehouseDialog } from "./warehouse-dialog";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function AssignedUsers({ warehouse }: { warehouse: Warehouse }) {
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const roles = useRoles();
  const canDo = useAuthorization();
  const [toAdd, setToAdd] = useState("");
  const [error, setError] = useState("");
  const manage = canManageUsers(actor, roles);
  const canSeeUsers = canDo("access.user.view");
  const assigned = users.filter((user) => user.warehouseIds.includes(warehouse.id));
  const candidates = users.filter((user) => user.status === "active" && !user.warehouseIds.includes(warehouse.id));

  async function change(userId: string, assign: boolean) {
    setError("");
    try {
      await setWarehouseAssignment(actor.id, userId, warehouse.id, warehouse.code, assign);
      setToAdd("");
    } catch (cause) {
      setError(cause instanceof AccessError ? cause.message : "Couldn't update the assignment.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned users</CardTitle>
        <CardDescription>People scoped to &ldquo;their warehouses&rdquo; can work here.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!canSeeUsers ? (
          <p className="text-sm text-muted-foreground">{assigned.length} users assigned.</p>
        ) : assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is assigned yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {assigned.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                {manage && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${user.name}`} onClick={() => void change(user.id, false)}>
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {manage && candidates.length > 0 && (
          <div className="flex gap-2">
            <select
              value={toAdd}
              onChange={(event) => setToAdd(event.target.value)}
              aria-label="User to assign"
              className="min-w-0 flex-1 rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">Assign a user…</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={!toAdd} onClick={() => void change(toAdd, true)}>
              <UserPlus data-icon="inline-start" />
              Assign
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function WarehouseDetails({ warehouseId }: { warehouseId: string }) {
  const warehouse = useWarehouses().find((candidate) => candidate.id === warehouseId);
  const users = useUsers();
  const canDo = useAuthorization();
  const stock = useStockByWarehouse().get(warehouseId);
  const [editOpen, setEditOpen] = useState(false);
  useBreadcrumbLabel(`/warehouses/${warehouseId}`, warehouse?.name);

  if (!warehouse || !canDo("inventory.warehouse.view", { warehouseId })) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Warehouse not found</h1>
        <LinkButton href="/warehouses" variant="outline" className="mt-2">
          Back to warehouses
        </LinkButton>
      </div>
    );
  }

  const canManage = canDo("inventory.warehouse.manage", { warehouseId });
  const canSeeCost = canDo("products.cost.view");
  const manager = users.find((user) => user.id === warehouse.managerId);
  const summary = [
    { label: "On hand", value: formatNumber(stock?.onHand ?? 0) },
    { label: "Available", value: formatNumber(stock?.available ?? 0) },
    { label: "Reserved", value: formatNumber(stock?.reserved ?? 0) },
    { label: "Damaged", value: formatNumber(stock?.damaged ?? 0) },
    { label: "Quarantined", value: formatNumber(stock?.quarantined ?? 0) },
    ...(canSeeCost ? [{ label: "Value at cost", value: formatCurrency(stock?.value ?? 0) }] : []),
  ];

  return (
    <>
      <PageHeader
        title={warehouse.name}
        description={`${warehouse.code}${warehouse.trackBins ? " · stock tracked by bin" : ""}`}
        actions={
          canManage && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
          {warehouse.trackBins ? (
            <LocationsPanel warehouse={warehouse} canManage={canManage} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Locations</CardTitle>
                <CardDescription>
                  Bin tracking is off: stock is counted per warehouse. Turn it on in Edit (while the warehouse is empty) to organize zones, racks and bins.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Row label="Status">
                  <StatusBadge tone={warehouse.status === "active" ? "success" : "neutral"}>{warehouse.status === "active" ? "Active" : "Inactive"}</StatusBadge>
                </Row>
                <Row label="Manager">{manager?.name ?? "—"}</Row>
                <Row label="Address">{warehouse.address || "—"}</Row>
                <Row label="Phone">{warehouse.phone || "—"}</Row>
                <Row label="Email">{warehouse.email || "—"}</Row>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Operating hours</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                {weekdays.map((day, index) => {
                  const hours = warehouse.hours[index];
                  return (
                    <Row key={day} label={day}>
                      {hours ? `${hours.open}–${hours.close}` : <span className="text-muted-foreground">Closed</span>}
                    </Row>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
          <AssignedUsers warehouse={warehouse} />
        </div>
      </div>

      <WarehouseDialog open={editOpen} onOpenChange={setEditOpen} warehouse={warehouse} />
    </>
  );
}
