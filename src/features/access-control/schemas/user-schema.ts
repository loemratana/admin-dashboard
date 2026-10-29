import { z } from "zod";

export const userSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  roleIds: z.array(z.string()).min(1, "Choose at least one role"),
  warehouseIds: z.array(z.string()),
  departmentId: z.string().nullable(),
  telegram: z
    .string()
    .trim()
    .refine((value) => value === "" || /^@[A-Za-z0-9_]{5,32}$/.test(value), "Use a Telegram username like @name (5–32 letters, digits or _)"),
});

export type UserInput = z.output<typeof userSchema>;
export type UserFormValues = z.input<typeof userSchema>;
export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export function validateUser(values: UserFormValues) {
  const result = userSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} as UserFormErrors };
  const errors: UserFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof UserFormValues;
    errors[field] ??= issue.message;
  }
  return { data: null, errors };
}
