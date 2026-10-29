"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Lock, TriangleAlert } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { fieldA11y, FormField } from "@/components/shared/form-field";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { permissionLabel } from "@/config/permissions";
import type { Role } from "@/types/access";

import { AccessError, cloneRole, createRole, updateRole } from "../api/access-api";
import { useCurrentUser, useRoles, useUsers } from "../hooks/use-access";
import {
  canEditRole,
  canManageRoles,
  diffGrants,
  grantableScopes,
  roleChangeViolations,
  scopeLabels,
  type GrantChange,
  type Grants,
} from "../policies/role-policy";
import { PermissionMatrix } from "./permission-matrix";

function ChangeList({ changes }: { changes: GrantChange[] }) {
  return (
    <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
      {changes.map(({ permission, from, to }) => (
        <li key={permission} className="flex gap-2">
          <span
            aria-hidden="true"
            className={`w-4 shrink-0 font-mono ${!from ? "text-emerald-700 dark:text-emerald-400" : !to ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
          >
            {!from ? "+" : !to ? "−" : "~"}
          </span>
          <span className="text-foreground">
            {permissionLabel(permission)}
            <span className="text-muted-foreground">
              {!from && ` (${scopeLabels[to!].toLowerCase()})`}
              {!to && " removed"}
              {from && to && `: ${scopeLabels[from].toLowerCase()} → ${scopeLabels[to].toLowerCase()}`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Edits an existing role, or creates one when `role` is omitted.
export function RoleEditor({ role }: { role?: Role }) {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const allRoles = useRoles();
  const users = useUsers();
  const idPrefix = useId();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [grants, setGrants] = useState<Grants>(role?.grants ?? {});
  const [nameError, setNameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useBreadcrumbLabel(role ? `/roles/${role.id}` : "", role?.name);

  const editable = canEditRole(actor, allRoles, role);
  const changes = useMemo(() => diffGrants(role?.grants ?? {}, grants), [role, grants]);
  const violations = editable ? roleChangeViolations(actor, allRoles, role?.id ?? null, grants) : [];
  const detailsChanged = name !== (role?.name ?? "") || description !== (role?.description ?? "");
  const dirty = detailsChanged || changes.length > 0;
  const members = role ? users.filter((user) => user.roleIds.includes(role.id)) : [];

  function requestSave() {
    const trimmed = name.trim();
    const duplicate = allRoles.some(
      (candidate) => candidate.id !== role?.id && candidate.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const error = !trimmed ? "Enter a role name" : duplicate ? "A role with this name already exists" : "";
    setNameError(error);
    setSaveError("");
    if (error) {
      document.getElementById(`${idPrefix}-name`)?.focus();
      return;
    }
    setPreviewOpen(true);
  }

  async function save() {
    const input = { name: name.trim(), description: description.trim(), grants };
    try {
      if (role) {
        await updateRole(actor.id, role.id, input);
        router.push("/roles");
      } else {
        const created = await createRole(actor.id, input);
        router.push(`/roles/${created.id}`);
      }
    } catch (error) {
      setSaveError(error instanceof AccessError ? error.message : "Couldn't save the role.");
    }
  }

  async function handleClone() {
    if (!role) return;
    try {
      const copy = await cloneRole(actor.id, role.id);
      router.push(`/roles/${copy.id}`);
    } catch (error) {
      setSaveError(error instanceof AccessError ? error.message : "Couldn't clone the role.");
    }
  }

  return (
    <>
      <PageHeader
        title={role ? role.name : "New role"}
        description={role ? role.description : "Choose what people with this role can do."}
        actions={
          role &&
          canManageRoles(actor, allRoles) && (
            <Button variant="outline" onClick={handleClone}>
              <Copy data-icon="inline-start" />
              Clone
            </Button>
          )
        }
      />

      {role?.isSystem && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <Lock aria-hidden="true" className="size-4 shrink-0" />
          System role: it can&apos;t be changed or deleted. Clone it to make a custom version.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:order-2 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {editable ? (
                <>
                  <FormField id={`${idPrefix}-name`} label="Role name" required error={nameError}>
                    <Input
                      {...fieldA11y(`${idPrefix}-name`, nameError)}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setNameError("");
                      }}
                      placeholder="e.g. Night Shift Supervisor"
                    />
                  </FormField>
                  <FormField id={`${idPrefix}-description`} label="Description">
                    <Textarea
                      {...fieldA11y(`${idPrefix}-description`)}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                    />
                  </FormField>
                </>
              ) : (
                <dl className="grid gap-1 text-sm">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>
                    <StatusBadge tone={role?.isSystem ? "info" : "neutral"}>
                      {role?.isSystem ? "System" : "Custom"}
                    </StatusBadge>
                  </dd>
                </dl>
              )}
            </CardContent>
          </Card>

          {role && (
            <Card>
              <CardHeader>
                <CardTitle>People with this role</CardTitle>
                <CardDescription>
                  {members.length === 0 ? "Nobody yet." : `${members.length} ${members.length === 1 ? "user" : "users"}`}
                </CardDescription>
              </CardHeader>
              {members.length > 0 && (
                <CardContent>
                  <ul className="divide-y divide-border text-sm">
                    {members.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{member.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                        </span>
                        {member.status !== "active" && <StatusBadge tone="neutral">{member.status}</StatusBadge>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          )}

          {editable && (
            <div className="flex flex-col gap-3">
              {violations.length > 0 && (
                <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <p className="flex items-center gap-2 font-medium">
                    <TriangleAlert aria-hidden="true" className="size-4" />
                    Can&apos;t save yet
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {violations.map((violation) => (
                      <li key={violation}>{violation}</li>
                    ))}
                  </ul>
                </div>
              )}
              {saveError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}
              <div className="flex gap-2 lg:justify-end">
                <LinkButton href="/roles" variant="outline">
                  Cancel
                </LinkButton>
                <Button onClick={requestSave} disabled={!dirty || violations.length > 0}>
                  {role ? "Review changes" : "Review and create"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 lg:order-1 lg:col-span-2">
          <PermissionMatrix
            grants={grants}
            onChange={setGrants}
            readOnly={!editable}
            grantableScopes={(permission) => grantableScopes(actor, allRoles, permission)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={role ? `Save changes to ${role.name}?` : `Create ${name.trim()}?`}
        confirmLabel={role ? "Save changes" : "Create role"}
        onConfirm={() => void save()}
        description={
          <>
            {changes.length === 0 ? (
              <p>Only the name or description changes; permissions stay the same.</p>
            ) : (
              <p>
                {changes.length} permission {changes.length === 1 ? "change" : "changes"}
                {role && (
                  <>
                    {" "}
                    affecting{" "}
                    <span className="font-medium text-foreground">
                      {members.length} {members.length === 1 ? "user" : "users"}
                    </span>
                  </>
                )}
                :
              </p>
            )}
            {changes.length > 0 && <ChangeList changes={changes} />}
          </>
        }
      />
    </>
  );
}
