"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { allPermissions, permissionModules, type PermissionKey } from "@/config/permissions";
import { grantedScopes, widestScope } from "@/lib/authorization";
import type { User } from "@/types/access";

import { useRoles } from "../hooks/use-access";
import { scopeLabels } from "../policies/role-policy";

// What a set of roles adds up to: every permission any of them grants, at its widest scope.
export function EffectiveAccess({ roleIds }: { roleIds: string[] }) {
  const roles = useRoles();
  const probe: User = { id: "preview", name: "", email: "", status: "active", roleIds, warehouseIds: [], departmentId: null, telegram: "", lastLoginAt: null };

  const modules = permissionModules
    .map((module) => ({
      ...module,
      granted: module.permissions.flatMap((permission) => {
        const scope = widestScope(grantedScopes(probe, roles, permission.key as PermissionKey));
        return scope ? [{ ...permission, scope }] : [];
      }),
    }))
    .filter((module) => module.granted.length > 0);
  const total = modules.reduce((sum, module) => sum + module.granted.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resulting access</CardTitle>
        <CardDescription>
          {total === 0 ? "No access yet. Choose at least one role." : `${total} of ${allPermissions.length} permissions from the selected roles`}
        </CardDescription>
      </CardHeader>
      {modules.length > 0 && (
        <CardContent>
          <ul className="divide-y divide-border">
            {modules.map((module) => (
              <li key={module.id} className="py-1.5 first:pt-0 last:pb-0">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{module.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {module.granted.length} of {module.permissions.length}
                    </span>
                  </summary>
                  <ul className="mt-1.5 mb-1 space-y-1 pl-3 text-xs">
                    {module.granted.map((permission) => (
                      <li key={permission.key} className="flex justify-between gap-2">
                        <span>{permission.label}</span>
                        <span className="shrink-0 text-muted-foreground">{scopeLabels[permission.scope]}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
