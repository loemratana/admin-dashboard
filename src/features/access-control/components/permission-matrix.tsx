"use client";

import { useId } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { permissionModules, type PermissionKey } from "@/config/permissions";
import type { AccessScope } from "@/types/access";

import { scopeLabels, type Grants } from "../policies/role-policy";

type PermissionMatrixProps = {
  grants: Grants;
  onChange: (grants: Grants) => void;
  readOnly: boolean;
  // Scopes the current user may hand out, narrowest first (empty = can't grant it).
  grantableScopes: (permission: PermissionKey) => AccessScope[];
};

export function PermissionMatrix({ grants, onChange, readOnly, grantableScopes }: PermissionMatrixProps) {
  // Unique per instance: Next.js keeps visited pages mounted (hidden), so two matrices can coexist.
  const idPrefix = useId();
  const setGrant = (next: Grants, permission: PermissionKey, scope: AccessScope | null) => {
    if (scope) next[permission] = scope;
    else delete next[permission];
  };

  // New grants default to the widest scope the editor may give.
  const defaultScope = (permission: PermissionKey) => grantableScopes(permission).at(-1) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {permissionModules.map((module) => {
        const keys = module.permissions.map((permission) => permission.key as PermissionKey);
        const grantedCount = keys.filter((key) => grants[key]).length;
        const allGranted = grantedCount === keys.length;
        const someGranted = grantedCount > 0 && !allGranted;
        // Select-all only adds what the editor is allowed to grant.
        const canAddAny = keys.some((key) => !grants[key] && defaultScope(key));
        const moduleToggleDisabled = readOnly || (!allGranted && !canAddAny && grantedCount === 0);

        return (
          <Card key={module.id}>
            <CardHeader className="flex flex-row items-center gap-3">
              <Checkbox
                checked={allGranted}
                indeterminate={someGranted}
                disabled={moduleToggleDisabled}
                aria-label={`All ${module.label} permissions`}
                onCheckedChange={() => {
                  const next = { ...grants };
                  if (allGranted || (someGranted && !canAddAny)) keys.forEach((key) => setGrant(next, key, null));
                  else keys.forEach((key) => !next[key] && setGrant(next, key, defaultScope(key)));
                  onChange(next);
                }}
              />
              <CardTitle className="flex-1">{module.label}</CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {grantedCount} of {keys.length}
              </span>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {module.permissions.map((permission) => {
                  const key = permission.key as PermissionKey;
                  const scope = grants[key] ?? null;
                  const allowed = grantableScopes(key);
                  // Keep an existing scope selectable even if it's wider than the editor's own.
                  const options = scope && !allowed.includes(scope) ? [...allowed, scope] : allowed;
                  const checkboxId = `${idPrefix}-${key}`;
                  return (
                    <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0">
                      <Checkbox
                        id={checkboxId}
                        checked={scope !== null}
                        disabled={readOnly || (scope === null && allowed.length === 0)}
                        onCheckedChange={(checked) => {
                          const next = { ...grants };
                          setGrant(next, key, checked ? defaultScope(key) : null);
                          onChange(next);
                        }}
                      />
                      <label htmlFor={checkboxId} className="min-w-0 flex-1 text-sm">
                        {permission.label}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{key}</span>
                      </label>
                      <Select
                        items={options.map((option) => ({ value: option, label: scopeLabels[option] }))}
                        value={scope}
                        onValueChange={(value) => {
                          if (!value) return;
                          const next = { ...grants };
                          setGrant(next, key, value as AccessScope);
                          onChange(next);
                        }}
                        disabled={readOnly || scope === null}
                      >
                        <SelectTrigger size="sm" className="w-44" aria-label={`Scope for ${permission.label}`}>
                          <SelectValue placeholder="Not granted" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option} value={option} disabled={!allowed.includes(option)}>
                              {scopeLabels[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
