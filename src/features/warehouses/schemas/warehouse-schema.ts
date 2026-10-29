import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:00");

const operatingDay = z
  .object({ open: time, close: time })
  .refine((day) => day.open < day.close, { message: "Closing must be after opening" })
  .nullable();

export const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,10}$/, "Use 2–10 letters, numbers or dashes"),
  name: z.string().trim().min(1, "Enter a name").max(60, "Keep it under 60 characters"),
  address: z.string().trim().max(200, "Keep it under 200 characters"),
  managerId: z.string().nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-. ]{0,30}$/, "Use digits, spaces and + ( ) - only"),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"))]),
  hours: z.array(operatingDay).length(7),
  trackBins: z.boolean(),
});

export type WarehouseInput = z.output<typeof warehouseSchema>;
export type WarehouseFormValues = z.input<typeof warehouseSchema>;
export type WarehouseFormErrors = Partial<Record<keyof WarehouseFormValues, string>> & { hoursByDay?: Record<number, string> };

export function validateWarehouse(values: WarehouseFormValues) {
  const result = warehouseSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} as WarehouseFormErrors };
  const errors: WarehouseFormErrors = {};
  for (const issue of result.error.issues) {
    const [field, day] = issue.path as [keyof WarehouseFormValues, number?];
    if (field === "hours" && typeof day === "number") {
      errors.hoursByDay = { ...errors.hoursByDay, [day]: errors.hoursByDay?.[day] ?? issue.message };
    } else {
      errors[field] ??= issue.message;
    }
  }
  return { data: null, errors };
}
