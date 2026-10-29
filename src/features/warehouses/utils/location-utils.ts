import type { LocationType, StorageLocation, Warehouse } from "../types/warehouse";

export const locationTypes: LocationType[] = ["zone", "aisle", "rack", "shelf", "bin"];

export const locationTypeDisplay: Record<LocationType, { label: string; prefix: string }> = {
  zone: { label: "Zone", prefix: "Z" },
  aisle: { label: "Aisle", prefix: "A" },
  rack: { label: "Rack", prefix: "R" },
  shelf: { label: "Shelf", prefix: "S" },
  bin: { label: "Bin", prefix: "B" },
};

// Types allowed under a parent: anything deeper (null parent = top level).
export function childTypes(parentType: LocationType | null): LocationType[] {
  if (parentType === "bin") return [];
  return parentType ? locationTypes.slice(locationTypes.indexOf(parentType) + 1) : locationTypes;
}

export const segmentFor = (type: LocationType, number: number) =>
  `${locationTypeDisplay[type].prefix}${String(number).padStart(2, "0")}`;

export function nextSegmentNumber(siblings: StorageLocation[], type: LocationType) {
  const prefix = locationTypeDisplay[type].prefix;
  const used = siblings.filter((sibling) => sibling.type === type).map((sibling) => Number(sibling.segment.slice(prefix.length)) || 0);
  return Math.max(0, ...used) + 1;
}

// Ancestors first, the location itself last.
export function locationPath(location: StorageLocation, byId: Map<string, StorageLocation>): StorageLocation[] {
  const path: StorageLocation[] = [];
  for (let current: StorageLocation | undefined = location; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
    path.unshift(current);
  }
  return path;
}

// e.g. CDC-A01-R02-B05. Calculated, so renaming the warehouse code renames every location.
export function locationCode(location: StorageLocation, byId: Map<string, StorageLocation>, warehouse: Pick<Warehouse, "code">) {
  return [warehouse.code, ...locationPath(location, byId).map((step) => step.segment)].join("-");
}

// A location is usable only if it and every level above it are active.
export const isEffectivelyActive = (location: StorageLocation, byId: Map<string, StorageLocation>) =>
  locationPath(location, byId).every((step) => step.status === "active");

export type LocationNode = {
  location: StorageLocation;
  code: string;
  depth: number;
  active: boolean; // effectively active
  hasChildren: boolean;
};

// Depth-first list in code order, ready to render as an indented tree.
export function flattenTree(locations: StorageLocation[], warehouse: Pick<Warehouse, "code">): LocationNode[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const children = (parentId: string | null) =>
    locations.filter((location) => location.parentId === parentId).sort((a, b) => a.segment.localeCompare(b.segment));
  const out: LocationNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const location of children(parentId)) {
      out.push({
        location,
        code: locationCode(location, byId, warehouse),
        depth,
        active: isEffectivelyActive(location, byId),
        hasChildren: locations.some((candidate) => candidate.parentId === location.id),
      });
      walk(location.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const standardHours = () =>
  weekdays.map((_, index) => (index < 5 ? { open: "08:00", close: "17:00" } : null));
