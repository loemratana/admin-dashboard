import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { InventoryTransaction, TransactionType } from "../types/dashboard";
import { formatDateTime, formatNumber } from "@/lib/format";

const typeDisplay: Record<TransactionType, { label: string; icon: typeof ArrowDownLeft }> = {
  "stock-in": { label: "Stock in", icon: ArrowDownLeft },
  "stock-out": { label: "Stock out", icon: ArrowUpRight },
  adjustment: { label: "Adjustment", icon: SlidersHorizontal },
};

export function RecentTransactions({ transactions }: { transactions: InventoryTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Latest stock movements across all products</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="hidden sm:table-cell">Reference</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const { label, icon: Icon } = typeDisplay[transaction.type];
              const sign = transaction.quantity > 0 ? "+" : "−";
              return (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <p className="font-medium">{transaction.productName}</p>
                    <p className="text-xs text-muted-foreground">{transaction.sku}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon aria-hidden="true" className="size-3.5" />
                      {label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {sign}
                    {formatNumber(Math.abs(transaction.quantity))}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{transaction.reference}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDateTime(transaction.date)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
