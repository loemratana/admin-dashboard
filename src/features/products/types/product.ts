export type ProductStatus = "active" | "inactive" | "archived";

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string | null;
  unitId: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  status: ProductStatus;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
};

// A product joined with figures calculated from its variants (see hooks/use-products.ts).
export type ProductWithStock = Product & {
  quantity: number; // on hand across all variants and warehouses
  available: number; // on hand minus reserved and damaged
  stockValue: number; // quantity × cost, per variant
  hasVariants: boolean;
  variantCount: number;
  priceRange: { min: number; max: number }; // selling price across active variants
  searchKeys: string; // variant SKUs and barcodes, lowercase, for search and scanning
};

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";
