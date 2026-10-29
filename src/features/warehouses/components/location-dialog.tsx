"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useCategories } from "@/features/catalog/hooks/use-catalog";
import { useProducts } from "@/features/products/hooks/use-products";

import { createLocation, updateLocation } from "../api/locations-api";
import { WarehouseError } from "../api/warehouses-api";
import type { LocationType, StorageLocation, Warehouse } from "../types/warehouse";
import { childTypes, locationTypeDisplay, nextSegmentNumber, segmentFor } from "../utils/location-utils";

export type LocationDialogState =
  | { mode: "add"; parent: { location: StorageLocation; code: string } | null }
  | { mode: "edit"; location: StorageLocation; code: string };

type LocationDialogProps = {
  warehouse: Warehouse;
  siblingsOf: (parentId: string | null) => StorageLocation[];
  state: LocationDialogState | null;
  onClose: () => void;
};

export function LocationDialog({ warehouse, siblingsOf, state, onClose }: LocationDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {state && <LocationForm key={state.mode === "edit" ? state.location.id : (state.parent?.location.id ?? "top")} warehouse={warehouse} siblingsOf={siblingsOf} state={state} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

const selectClasses =
  "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

function LocationForm({ warehouse, siblingsOf, state, onDone }: { warehouse: Warehouse; siblingsOf: (parentId: string | null) => StorageLocation[]; state: LocationDialogState; onDone: () => void }) {
  const { user: actor } = useCurrentUser();
  const categories = useCategories();
  const products = useProducts();
  const idPrefix = useId();
  const editing = state.mode === "edit" ? state.location : null;
  const parent = state.mode === "add" ? state.parent : null;
  const types = childTypes(parent?.location.type ?? null);

  const [type, setType] = useState<LocationType>(editing?.type ?? (types.includes("bin") && parent ? "bin" : types[0]));
  const [number, setNumber] = useState(() => String(nextSegmentNumber(siblingsOf(parent?.location.id ?? null), editing?.type ?? (types.includes("bin") && parent ? "bin" : types[0]))));
  const [capacity, setCapacity] = useState(editing?.capacity === null || editing?.capacity === undefined ? "" : String(editing.capacity));
  const [allowed, setAllowed] = useState<string[]>(editing?.allowedCategoryIds ?? []);
  const [active, setActive] = useState(editing ? editing.status === "active" : true);
  const [error, setError] = useState("");

  const isBin = (editing?.type ?? type) === "bin";
  const preview = editing ? state.mode === "edit" && state.code : [parent?.code ?? warehouse.code, segmentFor(type, Number(number) || 0)].join("-");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const cap = isBin && capacity.trim() !== "" ? Number(capacity) : null;
    try {
      if (editing) {
        await updateLocation(
          actor.id,
          editing.id,
          { capacity: cap, allowedCategoryIds: isBin ? allowed : [], status: active ? "active" : "inactive" },
          (productId) => products.find((product) => product.id === productId)?.categoryId,
        );
      } else {
        await createLocation(actor.id, { warehouseId: warehouse.id, parentId: parent?.location.id ?? null, type, number: Number(number), capacity: cap, allowedCategoryIds: isBin ? allowed : [] });
      }
      onDone();
    } catch (cause) {
      setError(cause instanceof WarehouseError ? cause.message : "Couldn't save the location.");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${preview}` : parent ? `Add inside ${parent.code}` : "Add location"}</DialogTitle>
        <DialogDescription>{editing ? locationTypeDisplay[editing.type].label : `New code: ${preview}`}</DialogDescription>
      </DialogHeader>

      {!editing && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor={`${idPrefix}-type`} className="text-sm font-medium">
              Type
            </label>
            <select
              id={`${idPrefix}-type`}
              value={type}
              onChange={(event) => {
                const next = event.target.value as LocationType;
                setType(next);
                setNumber(String(nextSegmentNumber(siblingsOf(parent?.location.id ?? null), next)));
              }}
              className={selectClasses}
            >
              {types.map((option) => (
                <option key={option} value={option}>
                  {locationTypeDisplay[option].label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${idPrefix}-number`} className="text-sm font-medium">
              Number
            </label>
            <Input id={`${idPrefix}-number`} type="number" min="1" max="99" step="1" value={number} onChange={(event) => setNumber(event.target.value)} />
          </div>
        </div>
      )}

      {isBin && (
        <>
          <div className="grid gap-1.5">
            <label htmlFor={`${idPrefix}-capacity`} className="text-sm font-medium">
              Capacity (units)
            </label>
            <Input id={`${idPrefix}-capacity`} type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Unlimited" className="w-40" />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Allowed categories</legend>
            <p className="text-xs text-muted-foreground">None ticked means any product can go here.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allowed.includes(category.id)}
                    onCheckedChange={(checked) => setAllowed((list) => (checked ? [...list, category.id] : list.filter((id) => id !== category.id)))}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {editing && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={active} onCheckedChange={setActive} />
          <span>
            Active
            <span className="block text-xs text-muted-foreground">Inactive locations, and everything inside them, can&apos;t receive stock. Stock already there can still be taken out.</span>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">{editing ? "Save changes" : "Add location"}</Button>
      </DialogFooter>
    </form>
  );
}
