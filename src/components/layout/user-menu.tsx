"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, LogOut } from "lucide-react";

import { switchCurrentUser } from "@/features/access-control/api/access-api";
import { useCurrentUser, useRoles, useUsers } from "@/features/access-control/hooks/use-access";
import { useDismiss } from "@/hooks/use-dismiss";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, roles } = useCurrentUser();
  const users = useUsers();
  const allRoles = useRoles();

  useDismiss(containerRef, open, () => setOpen(false));

  const roleNames = (roleIds: string[]) =>
    roleIds.map((id) => allRoles.find((role) => role.id === id)?.name ?? id).join(" + ");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center gap-2 rounded-md p-1 hover:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {getInitials(user.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium">{user.name}</span>
          <span className="block text-xs leading-tight text-muted-foreground">{roles.map((role) => role.name).join(" + ")}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground sm:inline" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-border bg-card py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>

          {/* Until real sign-in exists, switch the simulated session to try each role's access. */}
          <div className="border-b border-border py-1">
            <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">View as (demo)</p>
            <div className="max-h-64 overflow-y-auto">
              {users
                .filter((candidate) => candidate.status === "active")
                .map((candidate) => {
                  const current = candidate.id === user.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={current}
                      onClick={() => {
                        switchCurrentUser(candidate.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{candidate.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {roleNames(candidate.roleIds)}
                        </span>
                      </span>
                      {current && <Check aria-hidden="true" className="size-4 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>

          <Link
            href="/login"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            <LogOut className="size-4" />
            Sign out
          </Link>
        </div>
      )}
    </div>
  );
}
