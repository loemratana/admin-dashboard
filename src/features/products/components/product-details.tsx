"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthorization } from "@/features/access-control/hooks/use-access";
import { useCatalogLookups } from "@/features/catalog/hooks/use-catalog";
import { ProductVariantsCard } from "@/features/product-variants/components/product-variants-card";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

import { useProduct } from "../hooks/use-products";
import { productStatusDisplay } from "../utils/product-status";
import { getStockStatus, stockStatusDisplay } from "../utils/stock-status";
import { ArchiveProductDialog } from "./archive-product-dialog";
import { ProductNotFound } from "./product-not-found";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function ProductDetails({ productId }: { productId: string }) {
  const product = useProduct(productId);
  const lookups = useCatalogLookups();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const canDo = useAuthorization();
  const canSeeCost = canDo("products.cost.view");

  useBreadcrumbLabel(`/products/${productId}`, product?.name);

  if (!product) return <ProductNotFound />;

  const archived = product.status === "archived";
  const status = productStatusDisplay[product.status];
  const stock = stockStatusDisplay[getStockStatus(product)];
  const unit = lookups.unit.get(product.unitId);
  const margin = product.sellingPrice > 0 ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100 : 0;

  return (
    <>
      <PageHeader
        title={product.name}
        description={product.sku}
        actions={
          <>
            {canDo("products.product.archive") && (
              <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                {archived ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
                {archived ? "Restore" : "Archive"}
              </Button>
            )}
            {canDo("products.product.update") && (
              <LinkButton href={`/products/${product.id}/edit`}>
                <Pencil data-icon="inline-start" />
                Edit
              </LinkButton>
            )}
          </>
        }
      />

      {archived && (
        <p className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          This product is archived. It&apos;s hidden from the product list, stock figures and alerts.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <DetailRow label="Status">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </DetailRow>
                <DetailRow label="Category">{lookups.category.get(product.categoryId)?.name ?? "—"}</DetailRow>
                <DetailRow label="Brand">
                  {product.brandId ? (lookups.brand.get(product.brandId)?.name ?? "—") : "—"}
                </DetailRow>
                <DetailRow label="Unit of measure">{unit ? `${unit.name} (${unit.abbreviation})` : "—"}</DetailRow>
              </dl>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1 text-sm whitespace-pre-line">{product.description || "No description."}</p>
              </div>
            </CardContent>
          </Card>
          <ProductVariantsCard product={product} unitAbbreviation={unit?.abbreviation} />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <DetailRow label="On hand">
                  {formatNumber(product.quantity)} {unit?.abbreviation}
                </DetailRow>
                <DetailRow label="Reorder level">{formatNumber(product.reorderLevel)}</DetailRow>
                <DetailRow label="Stock level">
                  <StatusBadge tone={stock.tone}>{stock.label}</StatusBadge>
                </DetailRow>
                {canSeeCost && (
                  <DetailRow label="Value at cost">{formatCurrency(product.stockValue)}</DetailRow>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                {canSeeCost && <DetailRow label="Cost price">{formatCurrency(product.costPrice)}</DetailRow>}
                <DetailRow label="Selling price">
                  {product.priceRange.min === product.priceRange.max
                    ? formatCurrency(product.priceRange.min)
                    : `${formatCurrency(product.priceRange.min)}–${formatCurrency(product.priceRange.max)}`}
                </DetailRow>
                {canSeeCost && <DetailRow label="Margin">{margin.toFixed(1)}%</DetailRow>}
              </dl>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Created {formatDateTime(product.createdAt)} · Updated {formatDateTime(product.updatedAt)} (UTC)
          </p>
        </div>
      </div>

      <ArchiveProductDialog product={archiveOpen ? product : null} onOpenChange={setArchiveOpen} />
    </>
  );
}
