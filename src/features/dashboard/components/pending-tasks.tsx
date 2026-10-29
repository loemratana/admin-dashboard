"use client";

import Link from "next/link";
import { CircleAlert, Circle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format";

import { useInventorySummary } from "../hooks/use-inventory-summary";
import type { PendingTask } from "../types/dashboard";

// `tasks` are the stored ones; the reorder task is derived live from stock levels.
export function PendingTasks({ tasks: storedTasks }: { tasks: PendingTask[] }) {
  const { outOfStock } = useInventorySummary();
  const tasks: PendingTask[] =
    outOfStock.length > 0
      ? [
          {
            id: "reorder-out",
            title: `Reorder ${outOfStock.length} out-of-stock ${outOfStock.length === 1 ? "product" : "products"}`,
            detail: outOfStock.map((product) => product.name).join(", "),
            priority: "high",
            href: "/products",
          },
          ...storedTasks,
        ]
      : storedTasks;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending tasks</CardTitle>
        <CardDescription>{tasks.length === 0 ? "You're all caught up." : `${tasks.length} open`}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const title = task.href ? (
              <Link href={task.href} className="hover:underline hover:underline-offset-4">
                {task.title}
              </Link>
            ) : (
              task.title
            );
            return (
              <li key={task.id} className="flex gap-3">
                {task.priority === "high" ? (
                  <CircleAlert aria-label="High priority" className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{task.detail}</p>
                </div>
                {task.due && (
                  <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                    Due {formatShortDate(task.due)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
