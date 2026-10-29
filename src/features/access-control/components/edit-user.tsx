"use client";

import { useState } from "react";
import { Ban, CircleCheck, Send } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/create-store";
import { formatDateTime } from "@/lib/format";
import type { User } from "@/types/access";

import { AccessError, resendInvite, setUserEnabled } from "../api/access-api";
import { auditStore } from "../api/audit-api";
import { useCurrentUser, useRoles, useUsers } from "../hooks/use-access";
import { canManageUsers, userChangeViolations } from "../policies/user-policy";
import { userStatusDisplay } from "../utils/user-status";
import { UserForm } from "./user-form";

const MAX_ACTIVITY = 8;

function AccountCard({ user }: { user: User }) {
  const { user: actor } = useCurrentUser();
  const roles = useRoles();
  const users = useUsers();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const manage = canManageUsers(actor, roles);
  const disableViolations = userChangeViolations(actor, roles, users, user.id, { roleIds: user.roleIds, status: "disabled" });
  const { label, tone } = userStatusDisplay[user.status];

  async function run(action: () => Promise<void>, success?: string) {
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ tone: "info", text: success });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof AccessError ? error.message : "Something went wrong." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge tone={tone}>{label}</StatusBadge>
          </dd>
          <dt className="text-muted-foreground">Last login</dt>
          <dd>{user.lastLoginAt ? `${formatDateTime(user.lastLoginAt)} UTC` : "Never"}</dd>
        </dl>
        {manage && (
          <div className="flex flex-wrap gap-2">
            {user.status === "invited" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void run(() => resendInvite(actor.id, user.id), `Invite resent to ${user.email}.`)}
              >
                <Send data-icon="inline-start" />
                Resend invite
              </Button>
            )}
            {user.status === "disabled" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void run(() => setUserEnabled(actor.id, user.id, true))}>
                <CircleCheck data-icon="inline-start" />
                Re-enable
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disableViolations.length > 0}
                onClick={() => setConfirmDisable(true)}
              >
                <Ban data-icon="inline-start" />
                Disable
              </Button>
            )}
          </div>
        )}
        {manage && user.status !== "disabled" && disableViolations.length > 0 && (
          <p className="text-xs text-muted-foreground">{disableViolations[0]}</p>
        )}
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`text-xs ${message.tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
          >
            {message.text}
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title="Disable user?"
        description={
          <>
            <span className="font-medium text-foreground">{user.name}</span> loses all access immediately. Their
            history is kept and you can re-enable them later.
          </>
        }
        confirmLabel="Disable"
        destructive
        onConfirm={() => void run(() => setUserEnabled(actor.id, user.id, false))}
      />
    </Card>
  );
}

function ActivityCard({ user }: { user: User }) {
  const entries = useStore(auditStore).filter((entry) => entry.actorId === user.id || entry.targetId === user.id);
  const users = useUsers();
  const nameOf = (id: string) => users.find((candidate) => candidate.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Access changes by or for this user, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {entries.slice(0, MAX_ACTIVITY).map((entry) => (
              <li key={entry.id}>
                <p>{entry.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.at)} UTC · by {entry.actorId === user.id ? "this user" : nameOf(entry.actorId)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function EditUser({ userId }: { userId: string }) {
  const user = useUsers().find((candidate) => candidate.id === userId);
  useBreadcrumbLabel(`/users/${userId}`, user?.name);

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">User not found</h1>
        <LinkButton href="/users" variant="outline" className="mt-2">
          Back to users
        </LinkButton>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={user.name} description={user.email} />
      {/* key: reset the form if a different user is shown. */}
      <UserForm
        key={user.id}
        user={user}
        aside={
          <>
            <AccountCard user={user} />
            <ActivityCard user={user} />
          </>
        }
      />
    </>
  );
}
