"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, Eye, MoreHorizontal, Send } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DataTable,
  DataTableContent,
  DataTableEmpty,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { usePagination } from "@/hooks/use-pagination";
import { formatDateTime } from "@/lib/format";
import type { User, UserStatus } from "@/types/access";

import { AccessError, resendInvite, setUserEnabled } from "../api/access-api";
import { useCurrentUser, useRoles, useUsers } from "../hooks/use-access";
import { canManageUsers, userChangeViolations } from "../policies/user-policy";
import { userStatusDisplay } from "../utils/user-status";

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function UsersTable() {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const users = useUsers();
  const roles = useRoles();
  const warehouses = useWarehouses();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [roleId, setRoleId] = useState("all");
  const [disableTarget, setDisableTarget] = useState<User | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const manage = canManageUsers(actor, roles);
  const roleName = (id: string) => roles.find((role) => role.id === id)?.name ?? id;
  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter(
        (user) =>
          (!query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)) &&
          (status === "all" || user.status === status) &&
          (roleId === "all" || user.roleIds.includes(roleId)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, search, status, roleId]);
  const isFiltered = search !== "" || status !== "all" || roleId !== "all";
  const pagination = usePagination(filtered, { pageSize: 10, resetKey: JSON.stringify([search, status, roleId]) });

  // Hide actions the policy would refuse (e.g. disabling yourself or the last Super Admin).
  const canSetStatus = (user: User, next: UserStatus) =>
    manage && userChangeViolations(actor, roles, users, user.id, { roleIds: user.roleIds, status: next }).length === 0;

  async function run(action: () => Promise<void>, success?: string) {
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ tone: "info", text: success });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof AccessError ? error.message : "Something went wrong." });
    }
  }

  const columns: DataTableColumn<User>[] = [
    {
      id: "user",
      header: "User",
      cell: (user) => (
        <div>
          <Link href={`/users/${user.id}`} className="font-medium hover:underline hover:underline-offset-4">
            {user.name}
          </Link>
          {user.id === actor.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      className: "whitespace-normal",
      cell: (user) => <span className="text-sm">{user.roleIds.map(roleName).join(", ")}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => {
        const { label, tone } = userStatusDisplay[user.status];
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      id: "warehouses",
      header: "Warehouses",
      cell: (user) =>
        user.warehouseIds.length > 0 ? user.warehouseIds.map(warehouseName).join(", ") : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "lastLogin",
      header: "Last login",
      cell: (user) =>
        user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-muted-foreground">Never</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`} />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/users/${user.id}`)}>
              <Eye />
              {manage ? "View and edit" : "View"}
            </DropdownMenuItem>
            {manage && user.status === "invited" && (
              <DropdownMenuItem onClick={() => void run(() => resendInvite(actor.id, user.id), `Invite resent to ${user.email}.`)}>
                <Send />
                Resend invite
              </DropdownMenuItem>
            )}
            {user.status !== "disabled" && canSetStatus(user, "disabled") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDisableTarget(user)}>
                  <Ban />
                  Disable
                </DropdownMenuItem>
              </>
            )}
            {user.status === "disabled" && manage && (
              <DropdownMenuItem onClick={() => void run(() => setUserEnabled(actor.id, user.id, true))}>
                <CircleCheck />
                Re-enable
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mb-3 text-sm ${message.tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
        >
          {message.text}
        </p>
      )}
      <DataTable>
        <DataTableToolbar>
          <DataTableSearch value={search} onChange={setSearch} placeholder="Search name or email..." />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as UserStatus | "all")}
            aria-label="Filter by status"
            className={selectClasses}
          >
            <option value="all">All statuses</option>
            {Object.entries(userStatusDisplay).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            aria-label="Filter by role"
            className={selectClasses}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </DataTableToolbar>
        <DataTableContent
          columns={columns}
          rows={pagination.pageItems}
          getRowId={(user) => user.id}
          emptyState={
            isFiltered ? (
              <DataTableEmpty title="No matching users" description="Try a different search or filter." />
            ) : (
              <DataTableEmpty title="No users yet" />
            )
          }
        />
        <DataTablePagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setPage}
        />
      </DataTable>

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => !open && setDisableTarget(null)}
        title="Disable user?"
        description={
          <>
            <span className="font-medium text-foreground">{disableTarget?.name}</span> loses all access immediately.
            Their history is kept and you can re-enable them later.
          </>
        }
        confirmLabel="Disable"
        destructive
        onConfirm={() => disableTarget && void run(() => setUserEnabled(actor.id, disableTarget.id, false))}
      />
    </>
  );
}
