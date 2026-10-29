"use client";

import { useId, useState } from "react";

import { fieldA11y, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, useUsers } from "@/features/access-control/hooks/use-access";

import { binTrackingBlocker, createWarehouse, updateWarehouse, WarehouseError } from "../api/warehouses-api";
import { validateWarehouse, type WarehouseFormErrors, type WarehouseFormValues } from "../schemas/warehouse-schema";
import type { Warehouse } from "../types/warehouse";
import { standardHours, weekdays } from "../utils/location-utils";

type WarehouseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Omit to create a new warehouse.
  warehouse?: Warehouse;
};

export function WarehouseDialog({ open, onOpenChange, warehouse }: WarehouseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {/* Keyed so each opening starts from the warehouse's current values. */}
        {open && <WarehouseForm key={warehouse?.id ?? "new"} warehouse={warehouse} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

// The form keeps every day's times even while it's marked closed, so ticking a
// day back on restores what was there.
type DayDraft = { isOpen: boolean; open: string; close: string };

const selectClasses =
  "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

function WarehouseForm({ warehouse, onDone }: { warehouse?: Warehouse; onDone: () => void }) {
  const { user: actor } = useCurrentUser();
  const managers = useUsers().filter((user) => user.status === "active");
  const idPrefix = useId();
  const [values, setValues] = useState<Omit<WarehouseFormValues, "hours">>({
    code: warehouse?.code ?? "",
    name: warehouse?.name ?? "",
    address: warehouse?.address ?? "",
    managerId: warehouse?.managerId ?? null,
    phone: warehouse?.phone ?? "",
    email: warehouse?.email ?? "",
    trackBins: warehouse?.trackBins ?? false,
  });
  const [days, setDays] = useState<DayDraft[]>(() =>
    (warehouse?.hours ?? standardHours()).map((day) => ({ isOpen: day !== null, open: day?.open ?? "08:00", close: day?.close ?? "17:00" })),
  );
  const [errors, setErrors] = useState<WarehouseFormErrors>({});
  const [saveError, setSaveError] = useState("");
  const binBlocker = warehouse ? binTrackingBlocker(warehouse.id) : null;

  const setField = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const setDay = (index: number, patch: Partial<DayDraft>) =>
    setDays((list) => list.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const { data, errors: nextErrors } = validateWarehouse({
      ...values,
      hours: days.map((day) => (day.isOpen ? { open: day.open, close: day.close } : null)),
    });
    setErrors(nextErrors);
    setSaveError("");
    if (!data) return;
    try {
      if (warehouse) await updateWarehouse(actor.id, warehouse.id, data);
      else await createWarehouse(actor.id, data);
      onDone();
    } catch (error) {
      if (error instanceof WarehouseError && error.message.includes("code")) setErrors({ code: error.message });
      else setSaveError(error instanceof WarehouseError ? error.message : "Couldn't save the warehouse.");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{warehouse ? `Edit ${warehouse.name}` : "Add warehouse"}</DialogTitle>
        <DialogDescription>Where stock is kept. The code appears on locations, transfers and reports.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <FormField id={`${idPrefix}-code`} label="Code" required error={errors.code}>
          <Input
            {...fieldA11y(`${idPrefix}-code`, errors.code)}
            value={values.code}
            onChange={(event) => setField("code", event.target.value)}
            placeholder="MAIN"
            className="uppercase placeholder:normal-case"
            autoComplete="off"
          />
        </FormField>
        <FormField id={`${idPrefix}-name`} label="Name" required error={errors.name}>
          <Input
            {...fieldA11y(`${idPrefix}-name`, errors.name)}
            value={values.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="e.g. North distribution center"
            autoComplete="off"
          />
        </FormField>
      </div>
      <FormField id={`${idPrefix}-address`} label="Address" error={errors.address}>
        <Textarea
          {...fieldA11y(`${idPrefix}-address`, errors.address)}
          value={values.address}
          onChange={(event) => setField("address", event.target.value)}
          rows={2}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={`${idPrefix}-manager`} label="Manager">
          <select
            id={`${idPrefix}-manager`}
            value={values.managerId ?? ""}
            onChange={(event) => setField("managerId", event.target.value || null)}
            className={selectClasses}
          >
            <option value="">No manager</option>
            {managers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={`${idPrefix}-phone`} label="Phone" error={errors.phone}>
          <Input {...fieldA11y(`${idPrefix}-phone`, errors.phone)} type="tel" value={values.phone} onChange={(event) => setField("phone", event.target.value)} />
        </FormField>
        <FormField id={`${idPrefix}-email`} label="Email" error={errors.email}>
          <Input {...fieldA11y(`${idPrefix}-email`, errors.email)} type="email" value={values.email} onChange={(event) => setField("email", event.target.value)} />
        </FormField>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Operating hours</legend>
        {weekdays.map((dayName, index) => {
          const day = days[index];
          const dayError = errors.hoursByDay?.[index];
          return (
            <div key={dayName} className="grid grid-cols-[6.5rem_auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={day.isOpen} onCheckedChange={(checked) => setDay(index, { isOpen: checked })} aria-label={`Open on ${dayName}`} />
                {dayName.slice(0, 3)}
              </label>
              {day.isOpen ? (
                <div className="flex items-center gap-2">
                  <Input type="time" value={day.open} onChange={(event) => setDay(index, { open: event.target.value })} aria-label={`${dayName} opens`} aria-invalid={dayError ? true : undefined} className="w-28" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="time" value={day.close} onChange={(event) => setDay(index, { close: event.target.value })} aria-label={`${dayName} closes`} aria-invalid={dayError ? true : undefined} className="w-28" />
                </div>
              ) : (
                <span className="text-muted-foreground">Closed</span>
              )}
              {dayError && <span className="text-xs text-red-600 dark:text-red-400">{dayError}</span>}
            </div>
          );
        })}
      </fieldset>

      <div className="flex items-start gap-3 rounded-lg border border-border p-3">
        <Checkbox
          id={`${idPrefix}-bins`}
          className="mt-0.5"
          checked={values.trackBins}
          disabled={binBlocker !== null}
          onCheckedChange={(checked) => setField("trackBins", checked)}
        />
        <label htmlFor={`${idPrefix}-bins`} className="text-sm">
          <span className="font-medium">Track stock by bin</span>
          <span className="block text-xs text-muted-foreground">
            {binBlocker ?? "Every unit must then be put in, and taken from, a specific bin. Set up zones, racks and bins on the warehouse page."}
          </span>
        </label>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">{warehouse ? "Save changes" : "Add warehouse"}</Button>
      </DialogFooter>
    </form>
  );
}
