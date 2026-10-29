"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { permissionLabel, type PermissionKey } from "@/config/permissions";
import { emitEvent } from "@/lib/events";

import { useCan, useCurrentUser } from "../hooks/use-access";

type RequirePermissionProps = {
  permission: PermissionKey;
  children: React.ReactNode;
};

// Page guard: renders the page only with the permission, otherwise a "no access"
// message, and reports the denied attempt to the audit log.
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const allowed = useCan(permission);
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const canSeeDashboard = useCan("dashboard.overview.view");

  useEffect(() => {
    if (!allowed) emitEvent("access.denied", { userId: user.id, permission, path: pathname });
  }, [allowed, user.id, permission, pathname]);

  if (allowed) return children;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
      <Lock aria-hidden="true" className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        It needs the &ldquo;{permissionLabel(permission)}&rdquo; permission. Ask an administrator if you need it.
      </p>
      {canSeeDashboard && (
        <LinkButton href="/" variant="outline" className="mt-2">
          Back to dashboard
        </LinkButton>
      )}
    </div>
  );
}
