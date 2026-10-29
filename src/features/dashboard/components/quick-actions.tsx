"use client";

import { ArrowDownLeft, ArrowUpRight, Package, Plus, type LucideIcon } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PermissionKey } from "@/config/permissions";
import { useAuthorization } from "@/features/access-control/hooks/use-access";

type QuickAction = {
  label: string;
  icon: LucideIcon;
  // Omit href until the screen exists; the action renders disabled with "Soon".
  href?: string;
  permission: PermissionKey;
};

const quickActions: QuickAction[] = [
  { label: "View products", icon: Package, href: "/products", permission: "products.product.view" },
  { label: "Add product", icon: Plus, href: "/products/new", permission: "products.product.create" },
  { label: "Record stock in", icon: ArrowDownLeft, href: "/inventory/receive", permission: "inventory.movement.receive" },
  { label: "Record stock out", icon: ArrowUpRight, href: "/inventory/issue", permission: "inventory.movement.issue" },
];

export function QuickActions() {
  const canDo = useAuthorization();
  const allowed = quickActions.filter((action) => canDo(action.permission));
  if (allowed.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {allowed.map(({ label, icon: Icon, href }) =>
          href ? (
            // A plain link styled as a button: Base UI's Button would give it role="button".
            <LinkButton key={label} href={href} variant="outline" className="h-auto justify-start py-2.5">
              <Icon data-icon="inline-start" />
              {label}
            </LinkButton>
          ) : (
            <Button key={label} variant="outline" className="h-auto justify-start py-2.5" disabled>
              <Icon data-icon="inline-start" />
              {label}
              <span className="ml-auto text-[10px] font-medium uppercase">Soon</span>
            </Button>
          ),
        )}
      </CardContent>
    </Card>
  );
}
