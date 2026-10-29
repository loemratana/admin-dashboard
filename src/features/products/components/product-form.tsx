"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fieldA11y, FormField } from "@/components/shared/form-field";
import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCan, useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useBrands, useCategories, useUnits } from "@/features/catalog/hooks/use-catalog";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatCurrency } from "@/lib/format";

import { createProduct, isSkuTaken, updateProduct } from "../api/products-api";
import {
  validateProduct,
  type ProductFormErrors,
  type ProductFormValues,
} from "../schemas/product-schema";
import type { ProductWithStock } from "../types/product";

const NO_BRAND = "none";

const emptyValues: ProductFormValues = {
  name: "",
  sku: "",
  description: "",
  categoryId: "",
  brandId: null,
  unitId: "",
  costPrice: "",
  sellingPrice: "",
  quantity: "0",
  openingWarehouseId: "",
  reorderLevel: "0",
  status: "active",
};

function toFormValues(product: ProductWithStock): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId,
    unitId: product.unitId,
    costPrice: String(product.costPrice),
    sellingPrice: String(product.sellingPrice),
    // Stock isn't edited here; these only apply when creating.
    quantity: "0",
    openingWarehouseId: "",
    reorderLevel: String(product.reorderLevel),
    status: product.status,
  };
}

const statusItems = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

type ProductFormProps = {
  // Omit to create a new product.
  product?: ProductWithStock;
};

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const categories = useCategories();
  const brands = useBrands();
  const units = useUnits();

  const [values, setValues] = useState<ProductFormValues>(() => (product ? toFormValues(product) : emptyValues));
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Unique per form instance: Next.js keeps visited pages mounted (hidden), so two forms can coexist.
  const idPrefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const fid = (field: keyof ProductFormValues) => `${idPrefix}-${field}`;

  const editing = product !== undefined;
  const archived = product?.status === "archived";
  const cancelHref = editing ? `/products/${product.id}` : "/products";

  const setField = <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's error as soon as it is edited.
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Without cost access the cost field is hidden: editing keeps the stored cost,
  // creating defaults it to 0 for someone with cost access to fill in.
  const canSeeCost = useCan("products.cost.view");
  const { user: actor } = useCurrentUser();
  // Bin-tracked warehouses take stock through Stock in, where the bin is chosen.
  const activeWarehouses = useWarehouses().filter((warehouse) => warehouse.status === "active" && !warehouse.trackBins);

  const cost = Number(values.costPrice);
  const selling = Number(values.sellingPrice);
  const pricesEntered = canSeeCost && values.costPrice !== "" && values.sellingPrice !== "" && selling > 0;
  const margin = pricesEntered ? ((selling - cost) / selling) * 100 : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data, errors: nextErrors } = validateProduct(
      canSeeCost || values.costPrice !== "" ? values : { ...values, costPrice: "0" },
    );
    if (data && isSkuTaken(data.sku, product?.id)) nextErrors.sku = "Another product already uses this SKU";

    setErrors(nextErrors);
    if (!data || Object.values(nextErrors).some(Boolean)) {
      // Move focus to the first problem so keyboard and screen-reader users land on it.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    setSubmitting(true);
    if (editing) {
      await updateProduct(product.id, data);
      router.push(`/products/${product.id}`);
    } else {
      const created = await createProduct(data, actor.id);
      // The page stays mounted in the background; start the next "Add product" visit empty.
      setValues(emptyValues);
      setSubmitting(false);
      router.push(`/products/${created.id}`);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id={fid("name")} label="Product name" required error={errors.name}>
              <Input
                {...fieldA11y(fid("name"), errors.name)}
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="e.g. Wireless Mouse"
                autoComplete="off"
              />
            </FormField>
            <FormField
              id={fid("sku")}
              label="SKU"
              required
              error={errors.sku}
              hint="Unique code, e.g. ELC-1007. Saved in capitals."
            >
              <Input
                {...fieldA11y(fid("sku"), errors.sku, true)}
                value={values.sku}
                onChange={(event) => setField("sku", event.target.value)}
                placeholder="ELC-1007"
                autoComplete="off"
                className="uppercase placeholder:normal-case"
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField id={fid("description")} label="Description" error={errors.description}>
                <Textarea
                  {...fieldA11y(fid("description"), errors.description)}
                  value={values.description}
                  onChange={(event) => setField("description", event.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {canSeeCost && (
              <FormField
                id={fid("costPrice")}
                label="Cost price"
                required
                error={errors.costPrice}
                hint="What you pay per unit"
              >
                <Input
                  {...fieldA11y(fid("costPrice"), errors.costPrice, true)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={values.costPrice}
                  onChange={(event) => setField("costPrice", event.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            )}
            <FormField
              id={fid("sellingPrice")}
              label="Selling price"
              required
              error={errors.sellingPrice}
              hint={
                margin === null ? (
                  "What customers pay per unit"
                ) : margin < 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Below cost: you lose {formatCurrency(cost - selling)} per unit
                  </span>
                ) : (
                  `Margin ${margin.toFixed(1)}% · ${formatCurrency(selling - cost)} per unit`
                )
              }
            >
              <Input
                {...fieldA11y(fid("sellingPrice"), errors.sellingPrice, true)}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.sellingPrice}
                onChange={(event) => setField("sellingPrice", event.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {editing ? (
              <div className="grid content-start gap-1.5">
                <p className="text-sm font-medium">Quantity on hand</p>
                <p className="text-sm">
                  {product.quantity}
                  {product.hasVariants && (
                    <span className="text-muted-foreground"> across {product.variantCount} variants</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Changes through stock transactions, not this form.</p>
              </div>
            ) : (
              <FormField
                id={fid("quantity")}
                label="Opening quantity"
                required
                error={errors.quantity}
                hint="Stock you have right now"
              >
                <Input
                  {...fieldA11y(fid("quantity"), errors.quantity, true)}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={values.quantity}
                  onChange={(event) => setField("quantity", event.target.value)}
                />
              </FormField>
            )}
            {!editing && Number(values.quantity) > 0 && (
              <FormField
                id={fid("openingWarehouseId")}
                label="Warehouse"
                required
                error={errors.openingWarehouseId}
                hint="Where the opening quantity is kept"
              >
                <Select
                  items={activeWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
                  value={values.openingWarehouseId || null}
                  onValueChange={(value) => setField("openingWarehouseId", value ?? "")}
                >
                  <SelectTrigger {...fieldA11y(fid("openingWarehouseId"), errors.openingWarehouseId, true)} className="w-full">
                    <SelectValue placeholder="Choose a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWarehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField
              id={fid("reorderLevel")}
              label="Reorder level"
              required
              error={errors.reorderLevel}
              hint="Flag as low stock at or below this quantity"
            >
              <Input
                {...fieldA11y(fid("reorderLevel"), errors.reorderLevel, true)}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={values.reorderLevel}
                onChange={(event) => setField("reorderLevel", event.target.value)}
              />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Classification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField id={fid("categoryId")} label="Category" required error={errors.categoryId}>
              <Select
                items={categories.map((category) => ({ value: category.id, label: category.name }))}
                value={values.categoryId || null}
                onValueChange={(value) => setField("categoryId", value ?? "")}
              >
                <SelectTrigger {...fieldA11y(fid("categoryId"), errors.categoryId)} className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={fid("brandId")} label="Brand" error={errors.brandId}>
              <Select
                items={[
                  { value: NO_BRAND, label: "No brand" },
                  ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
                ]}
                value={values.brandId ?? NO_BRAND}
                onValueChange={(value) => setField("brandId", !value || value === NO_BRAND ? null : value)}
              >
                <SelectTrigger {...fieldA11y(fid("brandId"), errors.brandId)} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND}>No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={fid("unitId")} label="Unit of measure" required error={errors.unitId}>
              <Select
                items={units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.abbreviation})` }))}
                value={values.unitId || null}
                onValueChange={(value) => setField("unitId", value ?? "")}
              >
                <SelectTrigger {...fieldA11y(fid("unitId"), errors.unitId)} className="w-full">
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            {archived && <CardDescription>Archived. Restore it from the product page to change its status.</CardDescription>}
          </CardHeader>
          {!archived && (
            <CardContent>
              <FormField id={fid("status")} label="Product status" hint="Inactive products stay listed but can't be sold.">
                <Select
                  items={statusItems}
                  value={values.status}
                  onValueChange={(value) => value && setField("status", value as ProductFormValues["status"])}
                >
                  <SelectTrigger {...fieldA11y(fid("status"), undefined, true)} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </CardContent>
          )}
        </Card>

        <div className="flex gap-2 lg:justify-end">
          <LinkButton href={cancelHref} variant="outline">
            Cancel
          </LinkButton>
          <Button type="submit" disabled={submitting}>
            {editing ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
