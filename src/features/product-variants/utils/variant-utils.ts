import type { ProductVariant, VariantAttribute } from "../types/variant";

export const MAX_ATTRIBUTES = 3;

// Every combination of attribute values, in attribute order: Size × Color -> [["S","Red"], ...].
export function combinations(attributes: VariantAttribute[]): string[][] {
  return attributes.reduce<string[][]>(
    (combos, attribute) => combos.flatMap((combo) => attribute.values.map((value) => [...combo, value])),
    [[]],
  );
}

// Identifies a variant by its option values in the given attribute order.
export const comboKey = (values: string[]) => values.join(" / ");

export const variantKey = (variant: ProductVariant, attributes: VariantAttribute[]) =>
  comboKey(attributes.map((attribute) => variant.options[attribute.name] ?? ""));

export const variantLabel = (variant: ProductVariant, attributes: VariantAttribute[]) =>
  attributes.length === 0 ? "Default" : variantKey(variant, attributes);

const slug = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const suggestVariantSku = (productSku: string, values: string[]) =>
  [productSku, ...values.map(slug)].filter(Boolean).join("-");

export const isDefaultVariant = (variant: ProductVariant) => Object.keys(variant.options).length === 0;

export function effectivePrices(variant: ProductVariant, product: { costPrice: number; sellingPrice: number }) {
  return {
    costPrice: variant.costPrice ?? product.costPrice,
    sellingPrice: variant.sellingPrice ?? product.sellingPrice,
  };
}
