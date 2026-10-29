"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { fieldA11y, FormField } from "@/components/shared/form-field";
import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { departments } from "@/config/departments";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import type { User } from "@/types/access";

import { AccessError, inviteUser, updateUser } from "../api/access-api";
import { useCurrentUser, useRoles, useUsers } from "../hooks/use-access";
import { canAssignRole, canManageUsers, userChangeViolations } from "../policies/user-policy";
import { validateUser, type UserFormErrors, type UserFormValues } from "../schemas/user-schema";
import { EffectiveAccess } from "./effective-access";

type UserFormProps = {
  // Omit to invite a new user.
  user?: User;
  // Extra cards for the side column (e.g. account status and activity on the edit page).
  aside?: React.ReactNode;
};

export function UserForm({ user, aside }: UserFormProps) {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const roles = useRoles();
  const users = useUsers();
  const warehouses = useWarehouses();
  const idPrefix = useId();
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<UserFormValues>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    roleIds: user?.roleIds ?? [],
    warehouseIds: user?.warehouseIds ?? [],
    departmentId: user?.departmentId ?? null,
    telegram: user?.telegram ?? "",
  });
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [saveError, setSaveError] = useState("");

  const editable = canManageUsers(actor, roles);
  const status = user?.status ?? "invited";
  const violations = editable
    ? userChangeViolations(actor, roles, users, user?.id ?? null, { roleIds: values.roleIds, status })
    : [];

  // Warehouse-scoped permissions do nothing without at least one warehouse.
  const needsWarehouse =
    values.warehouseIds.length === 0 &&
    roles.some((role) => values.roleIds.includes(role.id) && Object.values(role.grants).includes("warehouse"));

  const setField = <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((item) => item !== id));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const { data, errors: nextErrors } = validateUser(values);
    if (data && users.some((other) => other.id !== user?.id && other.email.toLowerCase() === data.email)) {
      nextErrors.email = "Another user already has this email";
    }
    setErrors(nextErrors);
    setSaveError("");
    if (!data || Object.values(nextErrors).some(Boolean)) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    try {
      if (user) {
        await updateUser(actor.id, user.id, data);
        router.push("/users");
      } else {
        await inviteUser(actor.id, data);
        router.push("/users");
      }
    } catch (error) {
      setSaveError(error instanceof AccessError ? error.message : "Couldn't save the user.");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id={`${idPrefix}-name`} label="Full name" required error={errors.name}>
              <Input
                {...fieldA11y(`${idPrefix}-name`, errors.name)}
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                disabled={!editable}
                autoComplete="off"
              />
            </FormField>
            <FormField
              id={`${idPrefix}-email`}
              label="Email"
              required
              error={errors.email}
              hint={user ? undefined : "The invite is sent here."}
            >
              <Input
                {...fieldA11y(`${idPrefix}-email`, errors.email, !user)}
                type="email"
                value={values.email}
                onChange={(event) => setField("email", event.target.value)}
                disabled={!editable}
                autoComplete="off"
              />
            </FormField>
            <FormField id={`${idPrefix}-department`} label="Department" hint="Approval rules can send requests to a department.">
              <select
                id={`${idPrefix}-department`}
                value={values.departmentId ?? ""}
                onChange={(event) => setField("departmentId", event.target.value || null)}
                disabled={!editable}
                className="w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
              >
                <option value="">No department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`${idPrefix}-telegram`} label="Telegram" error={errors.telegram} hint="Optional. Approval notifications are also sent here.">
              <Input
                {...fieldA11y(`${idPrefix}-telegram`, errors.telegram)}
                value={values.telegram}
                onChange={(event) => setField("telegram", event.target.value)}
                disabled={!editable}
                placeholder="@username"
                autoComplete="off"
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>A user gets everything any of their roles allows.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset aria-describedby={errors.roleIds ? `${idPrefix}-roles-error` : undefined}>
              <legend className="sr-only">Roles</legend>
              <ul className="divide-y divide-border">
                {roles.map((role) => {
                  const checked = values.roleIds.includes(role.id);
                  const assignable = canAssignRole(actor, roles, role);
                  const checkboxId = `${idPrefix}-role-${role.id}`;
                  return (
                    <li key={role.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Checkbox
                        id={checkboxId}
                        className="mt-0.5"
                        checked={checked}
                        // Removing is always allowed; adding needs the role to be within your own access.
                        disabled={!editable || (!checked && !assignable)}
                        aria-invalid={errors.roleIds ? true : undefined}
                        onCheckedChange={(on) => setField("roleIds", toggle(values.roleIds, role.id, on))}
                      />
                      <label htmlFor={checkboxId} className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{role.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {!assignable && editable ? "Includes access you don't have, so you can't assign it." : role.description}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {errors.roleIds && (
                <p id={`${idPrefix}-roles-error`} className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {errors.roleIds}
                </p>
              )}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warehouses</CardTitle>
            <CardDescription>Limits permissions scoped to &ldquo;their warehouses&rdquo;.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset>
              <legend className="sr-only">Warehouses</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {warehouses
                  // Inactive warehouses can't be newly assigned, but existing assignments stay visible.
                  .filter((warehouse) => warehouse.status === "active" || values.warehouseIds.includes(warehouse.id))
                  .map((warehouse) => {
                    const checkboxId = `${idPrefix}-wh-${warehouse.id}`;
                    return (
                      <div key={warehouse.id} className="flex items-center gap-2">
                        <Checkbox
                          id={checkboxId}
                          checked={values.warehouseIds.includes(warehouse.id)}
                          disabled={!editable}
                          onCheckedChange={(on) => setField("warehouseIds", toggle(values.warehouseIds, warehouse.id, on))}
                        />
                        <label htmlFor={checkboxId} className="text-sm">
                          {warehouse.name}
                          {warehouse.status === "inactive" && <span className="text-muted-foreground"> (inactive)</span>}
                        </label>
                      </div>
                    );
                  })}
              </div>
            </fieldset>
            {needsWarehouse && (
              <p className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                A selected role has warehouse-scoped permissions. Without a warehouse they won&apos;t apply anywhere.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        {aside}
        <EffectiveAccess roleIds={values.roleIds} />

        {editable && (
          <div className="flex flex-col gap-3">
            {violations.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
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
              <LinkButton href="/users" variant="outline">
                Cancel
              </LinkButton>
              <Button type="submit" disabled={violations.length > 0}>
                {user ? "Save changes" : "Send invite"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
