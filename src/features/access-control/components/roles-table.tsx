"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { allPermissions } from "@/config/permissions";
import type { Role } from "@/types/access";

import { AccessError, cloneRole, deleteRole } from "../api/access-api";
import { useCurrentUser, useRoles, useUsers } from "../hooks/use-access";
import { canDeleteRole, canManageRoles } from "../policies/role-policy";

export function RolesTable() {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const roles = useRoles();
  const users = useUsers();
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [error, setError] = useState("");

  const manage = canManageRoles(actor, roles);
  const memberCount = (roleId: string) => users.filter((user) => user.roleIds.includes(roleId)).length;

  async function handleClone(role: Role) {
    setError("");
    try {
      const copy = await cloneRole(actor.id, role.id);
      router.push(`/roles/${copy.id}`);
    } catch (cause) {
      setError(cause instanceof AccessError ? cause.message : "Couldn't clone the role.");
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Role</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Permissions</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const members = memberCount(role.id);
              const permissionCount = Object.keys(role.grants).length;
              return (
                <TableRow key={role.id}>
                  <TableCell className="max-w-md pl-4 whitespace-normal">
                    <Link href={`/roles/${role.id}`} className="font-medium hover:underline hover:underline-offset-4">
                      {role.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={role.isSystem ? "info" : "neutral"}>{role.isSystem ? "System" : "Custom"}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{members}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {permissionCount}
                    <span className="text-muted-foreground"> / {allPermissions.length}</span>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role.name}`} />}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/roles/${role.id}`)}>
                          <Eye />
                          {manage && !role.isSystem ? "View and edit" : "View"}
                        </DropdownMenuItem>
                        {manage && (
                          <DropdownMenuItem onClick={() => void handleClone(role)}>
                            <Copy />
                            Clone
                          </DropdownMenuItem>
                        )}
                        {canDeleteRole(actor, roles, users, role) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(role)}>
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete role?"
        description={
          <>
            <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently removed.
            Nobody has this role.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRole(actor.id, deleteTarget.id).catch((cause) =>
            setError(cause instanceof AccessError ? cause.message : "Couldn't delete the role."),
          );
        }}
      />
    </>
  );
}
