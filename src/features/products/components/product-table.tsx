"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Eye, MoreHorizontal, Pencil } from "lucide-react";

import {
  DataTable,
  DataTableContent,
  DataTableEmpty,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthorization } from "@/features/access-control/hooks/use-access";
import { useCatalogLookups, useCategories } from "@/features/catalog/hooks/use-catalog";
import { usePagination } from "@/hooks/use-pagination";

import { useProductFilters, type ProductStatusFilter } from "../hooks/use-product-filters";
import { useProducts } from "../hooks/use-products";
import type { Product, ProductWithStock, StockStatus } from "../types/product";
import { productStatusDisplay } from "../utils/product-status";
import { getStockStatus, stockStatusDisplay } from "../utils/stock-status";
import { ArchiveProductDialog } from "./archive-product-dialog";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const selectClasses =
  "rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

export function ProductTable() {
  const router = useRouter();
  const products = useProducts();
  const categories = useCategories();
  const lookups = useCatalogLookups();
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const canDo = useAuthorization();
  const canCreate = canDo("products.product.create");
  const canEdit = canDo("products.product.update");
  const canArchive = canDo("products.product.archive");

  const filters = useProductFilters(products);
  const pagination = usePagination(filters.filteredProducts, { pageSize: 10, resetKey: filters.filterKey });

  const columns: DataTableColumn<ProductWithStock>[] = [
    {
      id: "name",
      header: "Product",
      cell: (product) => (
        <div>
          <Link href={`/products/${product.id}`} className="font-medium hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {product.sku}
            {product.hasVariants && ` · ${product.variantCount} variants`}
          </p>
        </div>
      ),
    },
    { id: "category", header: "Category", cell: (product) => lookups.category.get(product.categoryId)?.name ?? "—" },
    {
      id: "brand",
      header: "Brand",
      cell: (product) => (product.brandId ? (lookups.brand.get(product.brandId)?.name ?? "—") : "—"),
    },
    {
      id: "price",
      header: "Price",
      className: "text-right tabular-nums",
      cell: ({ priceRange }) =>
        priceRange.min === priceRange.max
          ? currency.format(priceRange.min)
          : `${currency.format(priceRange.min)}–${currency.format(priceRange.max)}`,
    },
    {
      id: "quantity",
      header: "Qty",
      className: "text-right tabular-nums",
      cell: (product) => (
        <>
          {product.quantity}
          <span className="ml-1 text-xs text-muted-foreground">{lookups.unit.get(product.unitId)?.abbreviation}</span>
        </>
      ),
    },
    {
      id: "stock",
      header: "Stock",
      cell: (product) => {
        const { label, tone } = stockStatusDisplay[getStockStatus(product)];
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (product) => {
        const { label, tone } = productStatusDisplay[product.status];
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (product) => {
        const archived = product.status === "archived";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${product.name}`} />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                <Eye />
                View
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => router.push(`/products/${product.id}/edit`)}>
                  <Pencil />
                  Edit
                </DropdownMenuItem>
              )}
              {canArchive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setArchiveTarget(product)}>
                    {archived ? <ArchiveRestore /> : <Archive />}
                    {archived ? "Restore" : "Archive"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <DataTable>
        <DataTableToolbar>
          <DataTableSearch value={filters.search} onChange={filters.setSearch} placeholder="Search name or SKU..." />
          <select
            value={filters.categoryId}
            onChange={(event) => filters.setCategoryId(event.target.value)}
            aria-label="Filter by category"
            className={selectClasses}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={filters.stock}
            onChange={(event) => filters.setStock(event.target.value as StockStatus | "all")}
            aria-label="Filter by stock level"
            className={selectClasses}
          >
            <option value="all">All stock levels</option>
            {Object.entries(stockStatusDisplay).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => filters.setStatus(event.target.value as ProductStatusFilter)}
            aria-label="Filter by product status"
            className={selectClasses}
          >
            <option value="current">Active &amp; inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </DataTableToolbar>

        <DataTableContent
          columns={columns}
          rows={pagination.pageItems}
          getRowId={(product) => product.id}
          emptyState={
            filters.isFiltered ? (
              <DataTableEmpty
                title="No matching products"
                description="Try a different search or filter."
                action={
                  <button
                    type="button"
                    onClick={filters.resetFilters}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <DataTableEmpty
                title="No products yet"
                description="Products you add will appear here."
                action={
                  canCreate && (
                    <Link href="/products/new" className="text-sm font-medium underline underline-offset-4">
                      Add product
                    </Link>
                  )
                }
              />
            )
          }
        />

        <DataTablePagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setPage}
        />
      </DataTable>

      <ArchiveProductDialog product={archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)} />
    </>
  );
}
