import type { StatusTone } from "@/components/shared/status-badge";

import type { ProductStatus } from "../types/product";

export const productStatusDisplay: Record<ProductStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
};
