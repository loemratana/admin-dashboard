"use client";

import { LinkButton } from "@/components/shared/link-button";

import { useRoles } from "../hooks/use-access";
import { RoleEditor } from "./role-editor";

export function EditRole({ roleId }: { roleId: string }) {
  const role = useRoles().find((candidate) => candidate.id === roleId);

  if (!role) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Role not found</h1>
        <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        <LinkButton href="/roles" variant="outline" className="mt-2">
          Back to roles
        </LinkButton>
      </div>
    );
  }

  // key: reset the form's state if a different role is shown.
  return <RoleEditor key={role.id} role={role} />;
}
