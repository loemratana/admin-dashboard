"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert, X } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan, useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useStockLevels } from "@/features/stock/hooks/use-stock";
import { onHand, variantLevel } from "@/features/stock/utils/stock-math";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatCurrency } from "@/lib/format";

import { saveProductVariants, VariantError, type VariantDraft } from "../api/save-variants";
import { useProductVariants } from "../hooks/use-variants";
import type { ProductVariant, VariantAttribute } from "../types/variant";
import { combinations, comboKey, MAX_ATTRIBUTES, suggestVariantSku, variantKey } from "../utils/variant-utils";

const MAX_COMBINATIONS = 100;

type AttributeDraft = { id: number; name: string; valuesText: string };

type RowDraft = {
  sku: string;
  barcode: string;
  sellingPrice: string; // "" = use the product's price
  costPrice: string;
  openingQuantity: string; // new variants only
  active: boolean;
};

type VariantEditorProps = {
  product: { id: string; name: string; sku: string; costPrice: number; sellingPrice: number };
};

const parseValues = (text: string) => text.split(",").map((value) => value.trim()).filter(Boolean);

function rowFromVariant(variant: ProductVariant): RowDraft {
  return {
    sku: variant.sku,
    barcode: variant.barcode,
    sellingPrice: variant.sellingPrice === null ? "" : String(variant.sellingPrice),
    costPrice: variant.costPrice === null ? "" : String(variant.costPrice),
    openingQuantity: "0",
    active: variant.status === "active",
  };
}

export function VariantEditor({ product }: VariantEditorProps) {
  const router = useRouter();
  const { user: actor } = useCurrentUser();
  const canSeeCost = useCan("products.cost.view");
  const { attributes: savedAttributes, variants: savedVariants } = useProductVariants(product.id);
  const idPrefix = useId();

  const [attributeDrafts, setAttributeDrafts] = useState<AttributeDraft[]>(() =>
    savedAttributes.map((attribute, index) => ({ id: index, name: attribute.name, valuesText: attribute.values.join(", ") })),
  );
  const [nextAttributeId, setNextAttributeId] = useState(savedAttributes.length);
  const [rowEdits, setRowEdits] = useState<Record<string, RowDraft>>({});
  const [stockTarget, setStockTarget] = useState("");
  const [saveError, setSaveError] = useState("");
  const [openingWarehouseId, setOpeningWarehouseId] = useState("");
  const levels = useStockLevels();
  const stockOf = (variantId: string) => onHand(variantLevel(levels, variantId));
  // Bin-tracked warehouses take stock through Stock in, where the bin is chosen.
  const activeWarehouses = useWarehouses().filter((warehouse) => warehouse.status === "active" && !warehouse.trackBins);

  // --- attributes as typed, and their problems
  const attributeErrors = attributeDrafts.map((draft, index) => {
    const values = parseValues(draft.valuesText);
    if (!draft.name.trim()) return "Name the attribute";
    if (attributeDrafts.findIndex((other) => other.name.trim().toLowerCase() === draft.name.trim().toLowerCase()) !== index) {
      return "Another attribute has this name";
    }
    if (values.length === 0) return "Add at least one value";
    if (new Set(values.map((value) => value.toLowerCase())).size !== values.length) return "A value is listed twice";
    return "";
  });
  const attributesValid = attributeErrors.every((error) => !error);
  const attributes: VariantAttribute[] = attributesValid
    ? attributeDrafts.map((draft) => ({ name: draft.name.trim(), values: parseValues(draft.valuesText) }))
    : savedAttributes;

  // --- one row per combination; existing variants keep their data
  const combos = useMemo(() => combinations(attributes), [attributes]);
  const tooMany = combos.length > MAX_COMBINATIONS;
  const savedByKey = useMemo(() => {
    const map = new Map<string, ProductVariant>();
    for (const variant of savedVariants) {
      const isDefault = Object.keys(variant.options).length === 0;
      // The default variant only matches when there are no attributes.
      if (isDefault === (attributes.length === 0)) map.set(variantKey(variant, attributes), variant);
    }
    return map;
  }, [savedVariants, attributes]);

  const rows = tooMany
    ? []
    : combos.map((values) => {
        const key = comboKey(values);
        const saved = savedByKey.get(key);
        const draft =
          rowEdits[key] ??
          (saved
            ? rowFromVariant(saved)
            : {
                sku: values.length === 0 ? product.sku : suggestVariantSku(product.sku, values),
                barcode: "",
                sellingPrice: "",
                costPrice: "",
                openingQuantity: "0",
                active: true,
              });
        return { key, values, saved, draft };
      });

  // --- variants that would disappear
  const keptIds = new Set(rows.flatMap((row) => (row.saved ? [row.saved.id] : [])));
  const removed = savedVariants.filter((variant) => !keptIds.has(variant.id));
  const defaultWithStock = removed.find((variant) => Object.keys(variant.options).length === 0 && stockOf(variant.id) > 0);
  const blockedRemovals = removed.filter((variant) => stockOf(variant.id) > 0 && variant !== defaultWithStock);

  const needsOpeningWarehouse = rows.some(({ saved, draft }) => !saved && Number(draft.openingQuantity) > 0);

  const updateRow = (key: string, base: RowDraft, patch: Partial<RowDraft>) =>
    setRowEdits((current) => ({ ...current, [key]: { ...base, ...patch } }));

  const rowProblems = rows.flatMap(({ key, draft, saved }) => {
    const label = key || "the product";
    const problems: string[] = [];
    if (!/^[A-Za-z0-9_-]+$/.test(draft.sku.trim())) problems.push(`SKU for ${label}: letters, numbers, - or _ only`);
    for (const [name, value] of [["Selling price", draft.sellingPrice], ["Cost price", draft.costPrice]] as const) {
      if (value.trim() !== "" && !(Number(value) >= 0)) problems.push(`${name} for ${label} must be 0 or more`);
    }
    if (!saved && !(Number.isInteger(Number(draft.openingQuantity)) && Number(draft.openingQuantity) >= 0)) {
      problems.push(`Opening quantity for ${label} must be a whole number`);
    }
    return problems;
  });
  const skuCounts = rows.reduce((counts, row) => counts.set(row.draft.sku.trim().toUpperCase(), (counts.get(row.draft.sku.trim().toUpperCase()) ?? 0) + 1), new Map<string, number>());
  const duplicateSkus = [...skuCounts].filter(([, count]) => count > 1).map(([sku]) => sku);

  const blockers = [
    ...(tooMany ? [`${combos.length} combinations is too many. Keep it under ${MAX_COMBINATIONS}.`] : []),
    ...(!attributesValid ? ["Fix the attributes above."] : []),
    ...rowProblems,
    ...duplicateSkus.map((sku) => `SKU ${sku} is used by more than one variant`),
    ...blockedRemovals.map(
      (variant) => `${variantKey(variant, savedAttributes) || "The product"} still has ${stockOf(variant.id)} in stock, so it can't be removed.`,
    ),
    ...(defaultWithStock && !rows.some((row) => row.key === stockTarget) ? ["Choose which variant receives the existing stock."] : []),
    ...(needsOpeningWarehouse && !openingWarehouseId ? ["Choose a warehouse for the new variants' opening stock."] : []),
  ];

  async function save() {
    setSaveError("");
    const drafts: VariantDraft[] = rows.map(({ values, saved, draft }) => ({
      id: saved?.id,
      values,
      sku: draft.sku,
      barcode: draft.barcode,
      sellingPrice: draft.sellingPrice.trim() === "" ? null : Number(draft.sellingPrice),
      // Without cost access the cost field is hidden; keep what's stored.
      costPrice: canSeeCost ? (draft.costPrice.trim() === "" ? null : Number(draft.costPrice)) : (saved?.costPrice ?? null),
      openingQuantity: saved ? 0 : Number(draft.openingQuantity),
      status: draft.active ? "active" : "inactive",
    }));
    try {
      await saveProductVariants(actor.id, product.id, {
        attributes,
        variants: drafts,
        moveDefaultStockTo: defaultWithStock ? stockTarget : undefined,
        openingWarehouseId: needsOpeningWarehouse ? openingWarehouseId : undefined,
      });
      router.push(`/products/${product.id}`);
    } catch (error) {
      setSaveError(error instanceof VariantError ? error.message : "Couldn't save the variants.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
          <CardDescription>
            What the product varies by, like Size or Color. Separate values with commas. Remove every attribute to sell it
            as a single item.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {attributeDrafts.map((draft, index) => (
            <div key={draft.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-start gap-2">
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setAttributeDrafts((list) => list.map((item) => (item.id === draft.id ? { ...item, name: event.target.value } : item)))
                  }
                  placeholder="e.g. Size"
                  aria-label={`Attribute ${index + 1} name`}
                  aria-invalid={attributeErrors[index] ? true : undefined}
                  className="w-40"
                />
                <Input
                  value={draft.valuesText}
                  onChange={(event) =>
                    setAttributeDrafts((list) =>
                      list.map((item) => (item.id === draft.id ? { ...item, valuesText: event.target.value } : item)),
                    )
                  }
                  placeholder="e.g. Small, Medium, Large"
                  aria-label={`Attribute ${index + 1} values`}
                  aria-invalid={attributeErrors[index] ? true : undefined}
                  className="min-w-48 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove attribute ${draft.name || index + 1}`}
                  onClick={() => setAttributeDrafts((list) => list.filter((item) => item.id !== draft.id))}
                >
                  <X />
                </Button>
              </div>
              {attributeErrors[index] && <p className="text-xs text-red-600 dark:text-red-400">{attributeErrors[index]}</p>}
            </div>
          ))}
          {attributeDrafts.length < MAX_ATTRIBUTES && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAttributeDrafts((list) => [...list, { id: nextAttributeId, name: "", valuesText: "" }]);
                  setNextAttributeId((id) => id + 1);
                }}
              >
                <Plus data-icon="inline-start" />
                Add attribute
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{attributes.length === 0 ? "Single item" : `Variants (${rows.length})`}</CardTitle>
          <CardDescription>
            Leave a price empty to use the product&apos;s ({formatCurrency(product.sellingPrice)}). Stock for existing
            variants changes through stock transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {attributes.length > 0 && <TableHead>Variant</TableHead>}
                <TableHead>SKU</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Selling price</TableHead>
                {canSeeCost && <TableHead>Cost price</TableHead>}
                <TableHead>Stock</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ key, saved, draft }) => {
                const label = key || product.name;
                return (
                  <TableRow key={key}>
                    {attributes.length > 0 && <TableCell className="font-medium">{key}</TableCell>}
                    <TableCell>
                      <Input
                        value={draft.sku}
                        onChange={(event) => updateRow(key, draft, { sku: event.target.value })}
                        aria-label={`SKU for ${label}`}
                        className="w-44 font-mono text-xs uppercase"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={draft.barcode}
                        onChange={(event) => updateRow(key, draft, { barcode: event.target.value })}
                        aria-label={`Barcode for ${label}`}
                        placeholder="Optional"
                        className="w-36"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.sellingPrice}
                        onChange={(event) => updateRow(key, draft, { sellingPrice: event.target.value })}
                        aria-label={`Selling price for ${label}`}
                        placeholder={product.sellingPrice.toFixed(2)}
                        className="w-28"
                      />
                    </TableCell>
                    {canSeeCost && (
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.costPrice}
                          onChange={(event) => updateRow(key, draft, { costPrice: event.target.value })}
                          aria-label={`Cost price for ${label}`}
                          placeholder={product.costPrice.toFixed(2)}
                          className="w-28"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      {saved ? (
                        <span className="tabular-nums">{stockOf(saved.id)}</span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={draft.openingQuantity}
                          onChange={(event) => updateRow(key, draft, { openingQuantity: event.target.value })}
                          aria-label={`Opening quantity for ${label}`}
                          className="w-20"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={draft.active}
                        onCheckedChange={(checked) => updateRow(key, draft, { active: checked })}
                        aria-label={`${label} active`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {defaultWithStock && (
        <Card>
          <CardHeader>
            <CardTitle>Existing stock</CardTitle>
            <CardDescription>
              {product.name} has {stockOf(defaultWithStock.id)} in stock. Choose which variant it belongs to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label htmlFor={`${idPrefix}-stock-target`} className="sr-only">
              Variant that receives the existing stock
            </label>
            <select
              id={`${idPrefix}-stock-target`}
              value={stockTarget}
              onChange={(event) => setStockTarget(event.target.value)}
              className="rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">Choose a variant…</option>
              {rows.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.key}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {needsOpeningWarehouse && (
        <Card>
          <CardHeader>
            <CardTitle>Opening stock</CardTitle>
            <CardDescription>Where the new variants&apos; opening quantities are kept.</CardDescription>
          </CardHeader>
          <CardContent>
            <label htmlFor={`${idPrefix}-opening-warehouse`} className="sr-only">
              Warehouse for opening stock
            </label>
            <select
              id={`${idPrefix}-opening-warehouse`}
              value={openingWarehouseId}
              onChange={(event) => setOpeningWarehouseId(event.target.value)}
              className="rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">Choose a warehouse…</option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {removed.length > 0 && blockedRemovals.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Saving removes {removed.length} {removed.length === 1 ? "variant" : "variants"} that no longer match the
          attributes{defaultWithStock ? " (the single item, after moving its stock)" : ""}.
        </p>
      )}

      {blockers.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Can&apos;t save yet
          </p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}
      <div className="flex gap-2 sm:justify-end">
        <LinkButton href={`/products/${product.id}`} variant="outline">
          Cancel
        </LinkButton>
        <Button onClick={() => void save()} disabled={blockers.length > 0}>
          Save variants
        </Button>
      </div>
    </div>
  );
}
