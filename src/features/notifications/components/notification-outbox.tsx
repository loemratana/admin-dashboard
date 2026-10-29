"use client";

import { useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsers } from "@/features/access-control/hooks/use-access";
import { useStore } from "@/lib/create-store";
import { formatDateTime } from "@/lib/format";

import { outboxStore, type NotificationChannel } from "../api/notifications-api";

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function NotificationOutbox() {
  const notifications = useStore(outboxStore);
  const users = useUsers();
  const [channel, setChannel] = useState<NotificationChannel | "all">("all");
  const rows = notifications.filter((notification) => channel === "all" || notification.channel === channel);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Email and Telegram messages sent about approvals. Sending isn't connected yet: messages are recorded here exactly as they would be sent."
      />
      <div className="mb-3">
        <select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)} aria-label="Channel" className={selectClasses}>
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Sent</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nothing sent yet. Approval requests and decisions send notifications.
                </TableCell>
              </TableRow>
            )}
            {rows.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell className="pl-4 text-muted-foreground">{formatDateTime(notification.at)}</TableCell>
                <TableCell>
                  <StatusBadge tone={notification.channel === "email" ? "info" : "neutral"}>{notification.channel === "email" ? "Email" : "Telegram"}</StatusBadge>
                </TableCell>
                <TableCell>
                  {users.find((user) => user.id === notification.recipientId)?.name ?? "—"}
                  <p className="text-xs text-muted-foreground">{notification.address}</p>
                </TableCell>
                <TableCell className="max-w-96 whitespace-normal">
                  <Link href={notification.href} className="font-medium hover:underline hover:underline-offset-4">
                    {notification.subject}
                  </Link>
                  <p className="text-xs text-muted-foreground">{notification.body}</p>
                </TableCell>
                <TableCell className="pr-4">
                  <StatusBadge tone={notification.status === "failed" ? "danger" : notification.status === "sent" ? "success" : "warning"}>
                    {notification.status === "simulated" ? "Simulated" : notification.status === "sent" ? "Sent" : "Failed"}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
