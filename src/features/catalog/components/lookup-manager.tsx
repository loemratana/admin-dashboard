"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type LookupField = {
  key: string;
  label: string;
  placeholder: string;
  className?: string;
};

type LookupItem = { id: string; name: string } & Record<string, string>;

type LookupManagerProps = {
  title: string;
  noun: string; // singular, lowercase: "category"
  items: LookupItem[];
  fields: LookupField[]; // the first field is the unique display name
  usageCount: (id: string) => number;
  // Without it the list is read-only: no add, edit or delete.
  canManage: boolean;
  onCreate: (values: Record<string, string>) => void;
  onUpdate: (id: string, values: Record<string, string>) => void;
  onDelete: (id: string) => void;
};

const emptyValues = (fields: LookupField[]) => Object.fromEntries(fields.map((field) => [field.key, ""]));

export function LookupManager({
  title,
  noun,
  items,
  fields,
  usageCount,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
}: LookupManagerProps) {
  const [draft, setDraft] = useState(() => emptyValues(fields));
  const [draftError, setDraftError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LookupItem | null>(null);

  // Every field is required; the name must be unique (ignoring case).
  function validate(values: Record<string, string>, exceptId?: string) {
    const missing = fields.find((field) => !values[field.key]?.trim());
    if (missing) return `Enter a ${missing.label.toLowerCase()}`;
    const name = values[fields[0].key].trim().toLowerCase();
    if (items.some((item) => item.id !== exceptId && item.name.toLowerCase() === name)) {
      return `A ${noun} with this name already exists`;
    }
    return "";
  }

  const trimAll = (values: Record<string, string>) =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const error = validate(draft);
    setDraftError(error);
    if (error) return;
    onCreate(trimAll(draft));
    setDraft(emptyValues(fields));
  }

  function startEdit(item: LookupItem) {
    setEditingId(item.id);
    setEditValues(Object.fromEntries(fields.map((field) => [field.key, item[field.key] ?? ""])));
    setEditError("");
  }

  function saveEdit(id: string) {
    const error = validate(editValues, id);
    setEditError(error);
    if (error) return;
    onUpdate(id, trimAll(editValues));
    setEditingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {items.length} {items.length === 1 ? noun : title.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <form onSubmit={handleCreate} noValidate className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-start gap-2">
              {fields.map((field) => (
                <Input
                  key={field.key}
                  value={draft[field.key]}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }));
                    setDraftError("");
                  }}
                  placeholder={field.placeholder}
                  aria-label={`New ${noun} ${field.label.toLowerCase()}`}
                  aria-invalid={draftError ? true : undefined}
                  aria-describedby={draftError ? `new-${noun}-error` : undefined}
                  className={field.className ?? "min-w-48 flex-1"}
                />
              ))}
              <Button type="submit">
                <Plus data-icon="inline-start" />
                Add {noun}
              </Button>
            </div>
            {draftError && (
              <p id={`new-${noun}-error`} className="text-xs text-red-600 dark:text-red-400">
                {draftError}
              </p>
            )}
          </form>
        )}

        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()} yet.</li>
          )}
          {items.map((item) => {
            const used = usageCount(item.id);
            const editing = editingId === item.id;

            if (editing) {
              return (
                <li key={item.id} className="flex flex-col gap-1.5 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {fields.map((field, index) => (
                      <Input
                        key={field.key}
                        value={editValues[field.key]}
                        onChange={(event) => {
                          setEditValues((current) => ({ ...current, [field.key]: event.target.value }));
                          setEditError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveEdit(item.id);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        aria-label={`${field.label} for ${item.name}`}
                        aria-invalid={editError ? true : undefined}
                        autoFocus={index === 0}
                        className={field.className ?? "min-w-48 flex-1"}
                      />
                    ))}
                    <Button size="icon-sm" onClick={() => saveEdit(item.id)} aria-label={`Save ${item.name}`}>
                      <Check />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel editing"
                    >
                      <X />
                    </Button>
                  </div>
                  {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
                </li>
              );
            }

            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.name}
                    {fields.slice(1).map((field) => (
                      <span key={field.key} className="ml-2 font-normal text-muted-foreground">
                        {item[field.key]}
                      </span>
                    ))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {used === 0 ? "Not used" : `Used by ${used} ${used === 1 ? "product" : "products"}`}
                  </p>
                </div>
                {canManage && (
                  <>
                    <Button size="icon-sm" variant="ghost" onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`}>
                      <Pencil />
                    </Button>
                    {used > 0 ? (
                      <Tooltip>
                        {/* A disabled button gets no pointer events, so the tooltip sits on a wrapper. */}
                        <TooltipTrigger render={<span tabIndex={0} />} aria-label={`Can't delete ${item.name}`}>
                          <Button size="icon-sm" variant="ghost" disabled tabIndex={-1} aria-hidden="true">
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          In use by {used} {used === 1 ? "product" : "products"}. Reassign them first.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete ${item.name}`}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${noun}?`}
        description={
          <>
            <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently removed.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && onDelete(deleteTarget.id)}
      />
    </Card>
  );
}
