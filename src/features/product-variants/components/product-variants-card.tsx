"use client";

import { Layers } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan } from "@/features/access-control/hooks/use-access";
import { useStockLevels } from "@/features/stock/hooks/use-stock";
import { onHand, variantLevel } from "@/features/stock/utils/stock-math";
import { formatCurrency, formatNumber } from "@/lib/format";

import { useProductVariants } from "../hooks/use-variants";
import { effectivePrices, variantLabel } from "../utils/variant-utils";

type ProductVariantsCardProps = {
  product: { id: string; costPrice: number; sellingPrice: number };
  unitAbbreviation?: string;
};

export function ProductVariantsCard({ product, unitAbbreviation }: ProductVariantsCardProps) {
  const { attributes, variants } = useProductVariants(product.id);
  const canManage = useCan("products.variant.manage");
  const hasVariants = attributes.length > 0;
  const single = variants[0];
  const levels = useStockLevels();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
        <CardDescription>
          {hasVariants
            ? `${variants.length} variants by ${attributes.map((attribute) => attribute.name).join(" × ")}`
            : "Sold as a single item."}
        </CardDescription>
        {canManage && (
          <CardAction>
            <LinkButton href={`/products/${product.id}/variants`} variant="outline" size="sm">
              <Layers data-icon="inline-start" />
              {hasVariants ? "Manage variants" : "Add variants"}
            </LinkButton>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!hasVariants ? (
          <p className="text-sm text-muted-foreground">
            Barcode: <span className="text-foreground">{single?.barcode || "none"}</span>
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="hidden sm:table-cell">Barcode</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">{variantLabel(variant, attributes)}</TableCell>
                  <TableCell className="font-mono text-xs">{variant.sku}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{variant.barcode || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(effectivePrices(variant, product).sellingPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(onHand(variantLevel(levels, variant.id)))} {unitAbbreviation}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={variant.status === "active" ? "success" : "neutral"}>
                      {variant.status === "active" ? "Active" : "Inactive"}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
