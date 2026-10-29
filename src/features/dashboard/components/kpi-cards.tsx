"use client";

import { CircleX, DollarSign, Package, TriangleAlert, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCan } from "@/features/access-control/hooks/use-access";
import { formatCurrency, formatNumber } from "@/lib/format";

import { useInventorySummary } from "../hooks/use-inventory-summary";

type KpiCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClassName?: string;
};

function KpiCard({ label, value, detail, icon: Icon, iconClassName = "text-muted-foreground" }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon aria-hidden="true" className={`size-4 shrink-0 ${iconClassName}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function KpiCards() {
  const { kpis } = useInventorySummary();
  // Stock value is computed from cost prices.
  const canSeeCost = useCan("products.cost.view");

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {canSeeCost && (
        <KpiCard
          label="Stock value"
          value={formatCurrency(kpis.stockValue)}
          detail="Valued at cost price"
          icon={DollarSign}
        />
      )}
      <KpiCard
        label="Products"
        value={formatNumber(kpis.productCount)}
        detail={`${formatNumber(kpis.unitsInStock)} units across ${kpis.categoryCount} categories`}
        icon={Package}
      />
      <KpiCard
        label="Low stock"
        value={formatNumber(kpis.lowStockCount)}
        detail="At or below reorder level"
        icon={TriangleAlert}
        iconClassName="text-amber-600 dark:text-amber-400"
      />
      <KpiCard
        label="Out of stock"
        value={formatNumber(kpis.outOfStockCount)}
        detail="Need reordering now"
        icon={CircleX}
        iconClassName="text-red-600 dark:text-red-400"
      />
    </div>
  );
}
