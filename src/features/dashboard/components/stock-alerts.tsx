"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStockStatus, stockStatusDisplay } from "@/features/products/utils/stock-status";
import { formatNumber } from "@/lib/format";

import { useInventorySummary } from "../hooks/use-inventory-summary";

const MAX_ALERTS = 6;

export function StockAlerts() {
  const { alerts } = useInventorySummary();
  const shown = alerts.slice(0, MAX_ALERTS);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Stock alerts</CardTitle>
        <CardDescription>
          {alerts.length === 0 ? "Everything is above its reorder level." : `${alerts.length} products need attention`}
        </CardDescription>
        <CardAction>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {shown.map((product) => {
            const { label, tone } = stockStatusDisplay[getStockStatus(product)];
            return (
              <li key={product.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/products/${product.id}`}
                    className="block truncate text-sm font-medium hover:underline hover:underline-offset-4"
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(product.quantity)} left · reorder at {formatNumber(product.reorderLevel)}
                  </p>
                </div>
                <StatusBadge tone={tone}>{label}</StatusBadge>
              </li>
            );
          })}
        </ul>
        {alerts.length > MAX_ALERTS && (
          <p className="mt-3 text-xs text-muted-foreground">+{alerts.length - MAX_ALERTS} more in Products</p>
        )}
      </CardContent>
    </Card>
  );
}
