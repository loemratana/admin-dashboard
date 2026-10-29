"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";

import type { StockItem } from "../hooks/use-stock-items";

type ItemPickerProps = {
  items: StockItem[];
  value: string | null; // variant id
  onChange: (variantId: string | null) => void;
  label: string;
  invalid?: boolean;
};

const optionText = (item: StockItem) => `${item.variant.sku} — ${item.label}`;

// Type a name or SKU and pick from the suggestions, or scan/type a barcode or
// exact SKU. Native datalist keeps it keyboard- and scanner-friendly.
export function ItemPicker({ items, value, onChange, label, invalid }: ItemPickerProps) {
  const listId = useId();
  const selected = items.find((item) => item.variant.id === value);
  const [text, setText] = useState(selected ? optionText(selected) : "");

  function resolve(next: string) {
    setText(next);
    const query = next.trim().toLowerCase();
    const match =
      items.find((item) => optionText(item).toLowerCase() === query) ??
      items.find((item) => item.variant.sku.toLowerCase() === query) ??
      items.find((item) => item.variant.barcode && item.variant.barcode.toLowerCase() === query);
    onChange(match ? match.variant.id : null);
  }

  return (
    <>
      <Input
        list={listId}
        value={text}
        onChange={(event) => resolve(event.target.value)}
        onBlur={() => selected && setText(optionText(selected))}
        placeholder="Search name, SKU or scan barcode"
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
      />
      <datalist id={listId}>
        {items.map((item) => (
          <option key={item.variant.id} value={optionText(item)} />
        ))}
      </datalist>
    </>
  );
}
