// Sample catalog shared by the products and product-variants modules, so each
// can build its own in-memory store without importing the other.

type SeedRow = [
  sku: string,
  name: string,
  categoryId: string,
  brandId: string | null,
  unitId: string,
  costPrice: number,
  sellingPrice: number,
  quantity: number, // opening stock, held by the product's variants
  reorderLevel: number,
];

export const productSeed: SeedRow[] = [
  ["ELC-1001", "Wireless Mouse", "cat-electronics", "brd-logi", "unit-pc", 14.2, 24.99, 142, 30],
  ["ELC-1002", "Mechanical Keyboard", "cat-electronics", "brd-logi", "unit-pc", 52.0, 89.0, 18, 20],
  ["ELC-1003", "USB-C Hub", "cat-electronics", "brd-dell", "unit-pc", 21.75, 39.5, 0, 15],
  ["ELC-1004", '27" Monitor', "cat-electronics", "brd-dell", "unit-pc", 189.0, 279.0, 9, 5],
  ["ELC-1005", "Webcam HD", "cat-electronics", "brd-logi", "unit-pc", 33.4, 59.99, 64, 10],
  ["ELC-1006", "Noise-Cancelling Headphones", "cat-electronics", null, "unit-pc", 118.0, 199.0, 4, 8],
  ["OFF-2001", "A4 Copy Paper (500)", "cat-office", null, "unit-ream", 3.9, 6.49, 820, 200],
  ["OFF-2002", "Ballpoint Pens (12)", "cat-office", null, "unit-pack", 2.1, 4.99, 315, 100],
  ["OFF-2003", "Stapler", "cat-office", "brd-3m", "unit-pc", 5.6, 11.25, 0, 25],
  ["OFF-2004", "Sticky Notes", "cat-office", "brd-3m", "unit-pack", 1.8, 3.75, 96, 120],
  ["OFF-2005", "Desk Organizer", "cat-office", null, "unit-pc", 9.5, 18.0, 42, 15],
  ["FUR-3001", "Ergonomic Chair", "cat-furniture", "brd-herman", "unit-pc", 210.0, 349.0, 12, 4],
  ["FUR-3002", "Standing Desk", "cat-furniture", "brd-herman", "unit-pc", 330.0, 529.0, 3, 3],
  ["FUR-3003", "Filing Cabinet", "cat-furniture", null, "unit-pc", 98.0, 165.0, 7, 2],
  ["FUR-3004", "Bookshelf", "cat-furniture", null, "unit-pc", 70.0, 120.0, 0, 2],
  ["PKG-4001", "Shipping Boxes (25)", "cat-packaging", "brd-uline", "unit-box", 12.5, 22.0, 260, 50],
  ["PKG-4002", "Bubble Wrap Roll", "cat-packaging", "brd-uline", "unit-roll", 9.8, 17.5, 38, 40],
  ["PKG-4003", "Packing Tape", "cat-packaging", "brd-3m", "unit-roll", 1.2, 2.99, 410, 100],
  ["PKG-4004", "Label Printer Rolls", "cat-packaging", "brd-uline", "unit-roll", 7.4, 14.0, 11, 25],
  ["CLN-5001", "Disinfectant Wipes", "cat-cleaning", "brd-clorox", "unit-pack", 2.9, 5.49, 188, 60],
  ["CLN-5002", "Hand Sanitizer 1L", "cat-cleaning", null, "unit-bottle", 4.8, 9.99, 0, 30],
  ["CLN-5003", "Trash Bags (50)", "cat-cleaning", null, "unit-box", 6.6, 12.75, 74, 40],
  ["CLN-5004", "Glass Cleaner", "cat-cleaning", "brd-clorox", "unit-bottle", 2.2, 4.5, 33, 20],
  ["CLN-5005", "Microfiber Cloths (10)", "cat-cleaning", "brd-3m", "unit-pack", 3.9, 8.25, 15, 20],
];

export const seedProductId = (index: number) => `prd-${String(index + 1).padStart(4, "0")}`;

// Two sample products sold in variants. Quantities add up to the seed row's total.
export const variantSeed: Record<
  string,
  {
    attributes: { name: string; values: string[] }[];
    variants: { values: string[]; quantity: number; sellingPrice?: number; costPrice?: number }[];
  }
> = {
  "FUR-3001": {
    attributes: [{ name: "Color", values: ["Black", "Grey"] }],
    variants: [
      { values: ["Black"], quantity: 8 },
      { values: ["Grey"], quantity: 4 },
    ],
  },
  "PKG-4001": {
    attributes: [{ name: "Size", values: ["Small", "Medium", "Large"] }],
    variants: [
      { values: ["Small"], quantity: 100 },
      { values: ["Medium"], quantity: 100 },
      { values: ["Large"], quantity: 60, sellingPrice: 26.0, costPrice: 14.5 },
    ],
  },
};
