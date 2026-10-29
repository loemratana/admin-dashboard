// An option axis such as Size, with the values the product comes in.
export type VariantAttribute = {
  name: string;
  values: string[];
};

// The sellable, countable unit. A product without attributes has exactly one
// "default" variant (empty options) that carries its SKU. Stock is never stored
// here: it is calculated from the stock ledger per variant and warehouse.
export type ProductVariant = {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  // attribute name -> value, e.g. { Size: "Large" }; {} for the default variant
  options: Record<string, string>;
  // null = use the product's price
  costPrice: number | null;
  sellingPrice: number | null;
  status: "active" | "inactive";
};
