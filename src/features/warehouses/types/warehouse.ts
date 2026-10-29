export type WarehouseStatus = "active" | "inactive";

// Opening and closing time ("08:00"), or null when closed that day.
export type OperatingDay = { open: string; close: string } | null;

export type Warehouse = {
  id: string;
  code: string; // short unique code shown on documents, e.g. MAIN
  name: string;
  address: string;
  managerId: string | null; // a user
  phone: string;
  email: string;
  hours: OperatingDay[]; // 7 days, Monday first
  // When on, every unit of stock here must sit in a bin.
  trackBins: boolean;
  // Inactive warehouses keep their history but can't be chosen for new work.
  status: WarehouseStatus;
};

export type LocationType = "zone" | "aisle" | "rack" | "shelf" | "bin";

// A place inside a bin-tracked warehouse. Levels can be skipped (a bin can sit
// directly in an aisle), but each child is deeper than its parent.
export type StorageLocation = {
  id: string;
  warehouseId: string;
  parentId: string | null;
  type: LocationType;
  segment: string; // this level's part of the code, e.g. A01
  capacity: number | null; // bins only: max units; null = unlimited
  allowedCategoryIds: string[]; // bins only: empty = any category
  status: "active" | "inactive";
};
