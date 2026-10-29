import { z } from "zod";

import type { ProductStatus } from "../types/product";

// Form inputs arrive as strings; empty means "not entered" rather than 0.
const numberField = (label: string) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : Number(value)),
    z.number({ error: `Enter ${label}` }).min(0, "Can't be negative"),
  );

const wholeNumberField = (label: string) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : Number(value)),
    z.number({ error: `Enter ${label}` }).int("Use a whole number").min(0, "Can't be negative"),
  );

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(120, "Keep it under 120 characters"),
  sku: z
    .string()
    .trim()
    .min(1, "Enter a SKU")
    .max(40, "Keep it under 40 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only")
    .transform((sku) => sku.toUpperCase()),
  description: z.string().trim().max(1000, "Keep it under 1,000 characters"),
  categoryId: z.string().min(1, "Choose a category"),
  brandId: z.string().nullable(),
  unitId: z.string().min(1, "Choose a unit"),
  costPrice: numberField("a cost price"),
  sellingPrice: numberField("a selling price"),
  quantity: wholeNumberField("an opening quantity"),
  // Where the opening quantity is recorded; required when it is above 0.
  openingWarehouseId: z.string(),
  reorderLevel: wholeNumberField("a reorder level"),
  // "archived" only passes through when editing an archived product; archiving itself is a separate action.
  status: z.enum(["active", "inactive", "archived"]),
}).refine((product) => product.quantity === 0 || product.openingWarehouseId !== "", {
  path: ["openingWarehouseId"],
  message: "Choose where this stock is",
});

export type ProductInput = z.output<typeof productSchema>;

// What the form holds while editing: raw strings for every typed-in field.
export type ProductFormValues = {
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  brandId: string | null;
  unitId: string;
  costPrice: string;
  sellingPrice: string;
  quantity: string;
  openingWarehouseId: string;
  reorderLevel: string;
  status: ProductStatus;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export function validateProduct(values: ProductFormValues) {
  const result = productSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} as ProductFormErrors };

  const errors: ProductFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof ProductFormValues;
    errors[field] ??= issue.message;
  }
  return { data: null, errors };
}
