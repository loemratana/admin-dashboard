import { createStore } from "@/lib/create-store";

import type { Brand, Category, Unit } from "../types/catalog";

// Sample data held in memory until the backend exists. Replace these functions
// with real requests; components only go through this module and the hooks.
export const categoriesStore = createStore<Category[]>([
  { id: "cat-electronics", name: "Electronics" },
  { id: "cat-office", name: "Office Supplies" },
  { id: "cat-furniture", name: "Furniture" },
  { id: "cat-packaging", name: "Packaging" },
  { id: "cat-cleaning", name: "Cleaning" },
]);

export const brandsStore = createStore<Brand[]>([
  { id: "brd-logi", name: "Logitech" },
  { id: "brd-dell", name: "Dell" },
  { id: "brd-3m", name: "3M" },
  { id: "brd-herman", name: "Herman Miller" },
  { id: "brd-uline", name: "Uline" },
  { id: "brd-clorox", name: "Clorox" },
]);

export const unitsStore = createStore<Unit[]>([
  { id: "unit-pc", name: "Piece", abbreviation: "pc" },
  { id: "unit-box", name: "Box", abbreviation: "box" },
  { id: "unit-pack", name: "Pack", abbreviation: "pk" },
  { id: "unit-roll", name: "Roll", abbreviation: "roll" },
  { id: "unit-ream", name: "Ream", abbreviation: "ream" },
  { id: "unit-bottle", name: "Bottle", abbreviation: "btl" },
]);

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export async function createCategory(name: string): Promise<Category> {
  const category = { id: newId("cat"), name };
  categoriesStore.setState((list) => [...list, category]);
  return category;
}

export async function renameCategory(id: string, name: string) {
  categoriesStore.setState((list) => list.map((item) => (item.id === id ? { ...item, name } : item)));
}

export async function deleteCategory(id: string) {
  categoriesStore.setState((list) => list.filter((item) => item.id !== id));
}

export async function createBrand(name: string): Promise<Brand> {
  const brand = { id: newId("brd"), name };
  brandsStore.setState((list) => [...list, brand]);
  return brand;
}

export async function renameBrand(id: string, name: string) {
  brandsStore.setState((list) => list.map((item) => (item.id === id ? { ...item, name } : item)));
}

export async function deleteBrand(id: string) {
  brandsStore.setState((list) => list.filter((item) => item.id !== id));
}

export async function createUnit(name: string, abbreviation: string): Promise<Unit> {
  const unit = { id: newId("unit"), name, abbreviation };
  unitsStore.setState((list) => [...list, unit]);
  return unit;
}

export async function updateUnit(id: string, name: string, abbreviation: string) {
  unitsStore.setState((list) => list.map((item) => (item.id === id ? { ...item, name, abbreviation } : item)));
}

export async function deleteUnit(id: string) {
  unitsStore.setState((list) => list.filter((item) => item.id !== id));
}
