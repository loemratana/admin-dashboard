"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { departments } from "@/config/departments";
import { useCurrentUser, useRoles, useUsers } from "@/features/access-control/hooks/use-access";
import { adjustmentEffects } from "@/features/stock/utils/stock-math";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";

import { ApprovalError, createRule, DETAILED_NOTE_MIN, kindLabels, updateRule, type RuleInput } from "../api/approvals-api";
import type { ApprovalKind, ApprovalLevel, ApprovalRule, ApproverSpec } from "../types/approval";

const selectClasses = "w-full rounded-md border border-border bg-card py-1.5 pr-8 pl-3 text-sm focus:border-ring focus:outline-none";

// The reasons a rule can be limited to, per kind.
export const reasonOptions: Partial<Record<ApprovalKind, { value: string; label: string }[]>> = {
  adjustment: Object.entries(adjustmentEffects).map(([value, { label }]) => ({
    value,
    label,
  })),
};

const newLevel = (): ApprovalLevel => ({
  name: "",
  approver: { type: "permission" },
  escalateAfterHours: null,
  escalateTo: null,
});

export function RuleDialog({ kind, rule, open, onOpenChange }: { kind: ApprovalKind; rule: ApprovalRule | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">{open && <RuleForm kind={kind} rule={rule} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function RuleForm({ kind, rule, onDone }: { kind: ApprovalKind; rule: ApprovalRule | null; onDone: () => void }) {
  const { user: actor } = useCurrentUser();
  const warehouses = useWarehouses();
  const idPrefix = useId();
  const [values, setValues] = useState<RuleInput>(
    rule
      ? {
          name: rule.name,
          kind: rule.kind,
          active: rule.active,
          conditions: rule.conditions,
          levels: rule.levels,
          segregation: rule.segregation,
          requirements: rule.requirements,
        }
      : {
          name: "",
          kind,
          active: true,
          conditions: {
            warehouseIds: [],
            destinationWarehouseIds: [],
            reasons: [],
            minValue: null,
            maxValue: null,
            minQuantity: null,
            movement: "any",
          },
          levels: [{ ...newLevel(), name: "Approver" }],
          segregation: true,
          requirements: { documents: 0, detailedNote: false },
        },
  );
  const [error, setError] = useState("");
  const conditions = values.conditions;
  const setConditions = (patch: Partial<RuleInput["conditions"]>) =>
    setValues((current) => ({
      ...current,
      conditions: { ...current.conditions, ...patch },
    }));
  const setLevel = (index: number, patch: Partial<ApprovalLevel>) =>
    setValues((current) => ({
      ...current,
      levels: current.levels.map((level, position) => (position === index ? { ...level, ...patch } : level)),
    }));
  const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((item) => item !== value));
  const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text));
  const reasons = reasonOptions[values.kind] ?? [];

  async function save() {
    setError("");
    try {
      if (rule) await updateRule(actor.id, rule.id, values);
      else await createRule(actor.id, values);
      onDone();
    } catch (cause) {
      setError(cause instanceof ApprovalError ? cause.message : "Couldn't save the rule.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
        <DialogDescription>{kindLabels[values.kind]} approval. Requests already submitted keep the levels they started with.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <FormField id={`${idPrefix}-name`} label="Name" required>
          <Input id={`${idPrefix}-name`} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
        </FormField>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox checked={values.active} onCheckedChange={(active) => setValues((current) => ({ ...current, active }))} />
          Active
        </label>
      </div>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Applies when</legend>
        <p className="text-xs text-muted-foreground">Leave a condition empty to match anything.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField id={`${idPrefix}-min-value`} label="Value from ($)">
            <Input
              id={`${idPrefix}-min-value`}
              type="number"
              min="0"
              value={conditions.minValue ?? ""}
              onChange={(event) => setConditions({ minValue: numberOrNull(event.target.value) })}
            />
          </FormField>
          <FormField id={`${idPrefix}-max-value`} label="Value up to ($)">
            <Input
              id={`${idPrefix}-max-value`}
              type="number"
              min="0"
              value={conditions.maxValue ?? ""}
              onChange={(event) => setConditions({ maxValue: numberOrNull(event.target.value) })}
            />
          </FormField>
          <FormField id={`${idPrefix}-min-qty`} label="Quantity from">
            <Input
              id={`${idPrefix}-min-qty`}
              type="number"
              min="0"
              step="1"
              value={conditions.minQuantity ?? ""}
              onChange={(event) => setConditions({ minQuantity: numberOrNull(event.target.value) })}
            />
          </FormField>
        </div>
        <CheckboxList
          legend={values.kind === "transfer" ? "From warehouses" : "Warehouses"}
          options={warehouses.map((warehouse) => ({
            value: warehouse.id,
            label: warehouse.name,
          }))}
          selected={conditions.warehouseIds}
          onToggle={(value, on) =>
            setConditions({
              warehouseIds: toggle(conditions.warehouseIds, value, on),
            })
          }
        />
        {values.kind === "transfer" && (
          <>
            <CheckboxList
              legend="To warehouses"
              options={warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
              selected={conditions.destinationWarehouseIds}
              onToggle={(value, on) =>
                setConditions({
                  destinationWarehouseIds: toggle(conditions.destinationWarehouseIds, value, on),
                })
              }
            />
            <FormField id={`${idPrefix}-movement`} label="Movement">
              <select
                id={`${idPrefix}-movement`}
                value={conditions.movement}
                onChange={(event) =>
                  setConditions({
                    movement: event.target.value as typeof conditions.movement,
                  })
                }
                className={selectClasses}
              >
                <option value="any">Any</option>
                <option value="inter-warehouse">Between warehouses</option>
                <option value="bin">Bin to bin, same warehouse</option>
              </select>
            </FormField>
          </>
        )}
        {reasons.length > 0 && (
          <CheckboxList
            legend="Reasons"
            options={reasons}
            selected={conditions.reasons}
            onToggle={(value, on) => setConditions({ reasons: toggle(conditions.reasons, value, on) })}
          />
        )}
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Approval levels, in order</legend>
        {values.levels.length === 0 && <p className="text-sm text-muted-foreground">No approval: matching requests go straight through.</p>}
        {values.levels.map((level, index) => (
          <div key={index} className="grid gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
            <div className="flex items-end gap-2">
              <FormField id={`${idPrefix}-level-${index}`} label={`Level ${index + 1} name`} required>
                <Input id={`${idPrefix}-level-${index}`} value={level.name} onChange={(event) => setLevel(index, { name: event.target.value })} placeholder="e.g. Finance" />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove level ${index + 1}`}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    levels: current.levels.filter((_, position) => position !== index),
                  }))
                }
              >
                <Trash2 />
              </Button>
            </div>
            <ApproverPicker kind={values.kind} label={`Level ${index + 1} approver`} value={level.approver} onChange={(approver) => setLevel(index, { approver })} />
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:items-start">
              <FormField id={`${idPrefix}-esc-${index}`} label="Escalate after (h)">
                <Input
                  id={`${idPrefix}-esc-${index}`}
                  type="number"
                  min="1"
                  value={level.escalateAfterHours ?? ""}
                  placeholder="Never"
                  onChange={(event) => {
                    const hours = numberOrNull(event.target.value);
                    setLevel(index, {
                      escalateAfterHours: hours,
                      escalateTo:
                        hours === null
                          ? null
                          : (level.escalateTo ?? {
                              type: "role",
                              roleId: "admin",
                            }),
                    });
                  }}
                />
              </FormField>
              {level.escalateAfterHours !== null && level.escalateTo && (
                <ApproverPicker kind={values.kind} label={`Level ${index + 1} escalates to`} value={level.escalateTo} onChange={(escalateTo) => setLevel(index, { escalateTo })} />
              )}
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setValues((current) => ({
                ...current,
                levels: [...current.levels, newLevel()],
              }))
            }
          >
            <Plus data-icon="inline-start" />
            Add level
          </Button>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Evidence required</legend>
        <p className="text-xs text-muted-foreground">Checked when the request is submitted and again at every approval. Use it for sensitive requests.</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-end">
          {values.kind !== "transfer" && (
            <FormField id={`${idPrefix}-documents`} label="Supporting documents">
              <Input
                id={`${idPrefix}-documents`}
                type="number"
                min="0"
                max="5"
                step="1"
                value={values.requirements.documents}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    requirements: {
                      ...current.requirements,
                      documents: Number(event.target.value),
                    },
                  }))
                }
              />
            </FormField>
          )}
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={values.requirements.detailedNote}
              onCheckedChange={(detailedNote) =>
                setValues((current) => ({
                  ...current,
                  requirements: { ...current.requirements, detailedNote },
                }))
              }
            />
            Detailed note (at least {DETAILED_NOTE_MIN} characters)
          </label>
        </div>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={values.segregation} onCheckedChange={(segregation) => setValues((current) => ({ ...current, segregation }))} />
        <span>
          Requester can&apos;t approve their own request
          <span className="block text-xs text-muted-foreground">Segregation of duties. Nobody can approve more than one level of the same request either way.</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button onClick={() => void save()}>{rule ? "Save rule" : "Create rule"}</Button>
      </DialogFooter>
    </>
  );
}

function CheckboxList({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string, on: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">
        {legend} <span className="font-normal text-muted-foreground">({selected.length === 0 ? "any" : selected.length})</span>
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(option.value)} onCheckedChange={(on) => onToggle(option.value, on)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ApproverPicker({ kind, label, value, onChange }: { kind: ApprovalKind; label: string; value: ApproverSpec; onChange: (spec: ApproverSpec) => void }) {
  const roles = useRoles();
  const users = useUsers().filter((user) => user.status === "active");
  const id = useId();
  const pick = (type: ApproverSpec["type"]): ApproverSpec => {
    switch (type) {
      case "role":
        return { type, roleId: roles[0]?.id ?? "" };
      case "department":
        return { type, departmentId: departments[0].id };
      case "user":
        return { type, userId: users[0]?.id ?? "" };
      default:
        return { type };
    }
  };
  const targets =
    value.type === "role"
      ? {
          current: value.roleId,
          options: roles.map((role) => ({ value: role.id, label: role.name })),
          set: (roleId: string) => onChange({ type: "role", roleId }),
        }
      : value.type === "department"
        ? {
            current: value.departmentId,
            options: departments.map((department) => ({
              value: department.id,
              label: department.name,
            })),
            set: (departmentId: string) => onChange({ type: "department", departmentId }),
          }
        : value.type === "user"
          ? {
              current: value.userId,
              options: users.map((user) => ({
                value: user.id,
                label: user.name,
              })),
              set: (userId: string) => onChange({ type: "user", userId }),
            }
          : null;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <select id={id} value={value.type} onChange={(event) => onChange(pick(event.target.value as ApproverSpec["type"]))} className={selectClasses}>
          <option value="permission">Anyone with approve permission</option>
          <option value="warehouse-manager">{kind === "transfer" ? "The sending warehouse's manager" : "The warehouse's manager"}</option>
          {kind === "transfer" && <option value="destination-manager">The receiving warehouse&apos;s manager</option>}
          <option value="role">A role</option>
          <option value="department">A department</option>
          <option value="user">A specific person</option>
        </select>
        {targets && (
          <select value={targets.current} onChange={(event) => targets.set(event.target.value)} aria-label={`${label}: which`} className={selectClasses}>
            {targets.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
