"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan, useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useWarehouses } from "@/features/warehouses/hooks/use-warehouses";
import { formatCurrency, formatNumber } from "@/lib/format";

import { ApprovalError, deleteRule, kindLabels, liveKinds, moveRule } from "../api/approvals-api";
import { useApprovalRules, useDescribeApprover } from "../hooks/use-approvals";
import type { ApprovalKind, ApprovalRule } from "../types/approval";
import { reasonOptions, RuleDialog } from "./rule-dialog";

export function RulesManager() {
  const rules = useApprovalRules();
  const { user: actor } = useCurrentUser();
  const warehouses = useWarehouses();
  const describe = useDescribeApprover();
  const canManage = useCan("approvals.rule.manage");
  const [kind, setKind] = useState<ApprovalKind>(liveKinds[0]);
  const [editing, setEditing] = useState<{ rule: ApprovalRule | null } | null>(null);
  const [deleting, setDeleting] = useState<ApprovalRule | null>(null);
  const [error, setError] = useState("");

  const rows = rules.filter((rule) => rule.kind === kind).sort((a, b) => a.priority - b.priority);
  const warehouseNames = (ids: string[]) => ids.map((id) => warehouses.find((warehouse) => warehouse.id === id)?.code ?? id).join(", ");

  function conditionsText(rule: ApprovalRule) {
    const c = rule.conditions;
    const reasonLabel = (value: string) => reasonOptions[rule.kind]?.find((option) => option.value === value)?.label ?? value;
    const parts = [
      c.warehouseIds.length > 0 && `${rule.kind === "transfer" ? "from" : "in"} ${warehouseNames(c.warehouseIds)}`,
      c.destinationWarehouseIds.length > 0 && `to ${warehouseNames(c.destinationWarehouseIds)}`,
      c.movement === "bin" && "bin-to-bin moves",
      c.movement === "inter-warehouse" && "between warehouses",
      c.reasons.length > 0 && c.reasons.map(reasonLabel).join(" / "),
      c.minValue !== null && c.maxValue !== null && `value ${formatCurrency(c.minValue)}–${formatCurrency(c.maxValue)}`,
      c.minValue !== null && c.maxValue === null && `value ≥ ${formatCurrency(c.minValue)}`,
      c.minValue === null && c.maxValue !== null && `value ≤ ${formatCurrency(c.maxValue)}`,
      c.minQuantity !== null && `${formatNumber(c.minQuantity)}+ units`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Everything else";
  }

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof ApprovalError ? cause.message : "That didn't work.");
    }
  }

  return (
    <>
      <PageHeader
        title="Approval rules"
        description="Rules are checked top to bottom; the first one that matches a request decides who approves it. Without a match, anyone with the approve permission can approve."
        actions={
          canManage && (
            <Button onClick={() => setEditing({ rule: null })}>
              <Plus data-icon="inline-start" />
              New rule
            </Button>
          )
        }
      />
      {liveKinds.length > 1 && (
        <div role="group" aria-label="Request type" className="mb-3 flex flex-wrap gap-1">
          {liveKinds.map((candidate) => (
            <Button key={candidate} size="sm" variant={kind === candidate ? "secondary" : "ghost"} aria-pressed={kind === candidate} onClick={() => setKind(candidate)}>
              {kindLabels[candidate]}
            </Button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-4">#</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Applies when</TableHead>
              <TableHead>Approved by</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No rules: anyone with the approve permission can approve.
                </TableCell>
              </TableRow>
            )}
            {rows.map((rule, index) => (
              <TableRow key={rule.id}>
                <TableCell className="pl-4 tabular-nums">{index + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <span className="font-medium">{rule.name}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!rule.active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
                    {!rule.segregation && <StatusBadge tone="warning">Own approval allowed</StatusBadge>}
                    {rule.requirements.documents > 0 && (
                      <StatusBadge tone="info">{rule.requirements.documents === 1 ? "1 document" : `${rule.requirements.documents} documents`}</StatusBadge>
                    )}
                    {rule.requirements.detailedNote && <StatusBadge tone="info">Detailed note</StatusBadge>}
                  </div>
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal text-muted-foreground">{conditionsText(rule)}</TableCell>
                <TableCell className="max-w-72 whitespace-normal">
                  {rule.levels.length === 0 ? (
                    <span className="text-muted-foreground">No approval needed</span>
                  ) : (
                    <ol className="flex flex-col gap-0.5 text-sm">
                      {rule.levels.map((level, position) => (
                        <li key={position}>
                          {position + 1}. {level.name}
                          <span className="text-muted-foreground"> · {describe(level.approver)}</span>
                          {level.escalateAfterHours !== null && (
                            <span className="block pl-4 text-xs text-muted-foreground">
                              after {formatNumber(level.escalateAfterHours)} h → {describe(level.escalateTo)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {canManage && (
                    <div className="flex justify-end gap-0.5">
                      <Button size="icon" variant="ghost" aria-label={`Move ${rule.name} up`} disabled={index === 0} onClick={() => void run(() => moveRule(actor.id, rule.id, -1))}>
                        <ArrowUp />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Move ${rule.name} down`} disabled={index === rows.length - 1} onClick={() => void run(() => moveRule(actor.id, rule.id, 1))}>
                        <ArrowDown />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${rule.name}`} onClick={() => setEditing({ rule })}>
                        <Pencil />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${rule.name}`} onClick={() => setDeleting(rule)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RuleDialog kind={kind} rule={editing?.rule ?? null} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="Requests already submitted under it keep their levels. New requests fall through to the next matching rule."
        confirmLabel="Delete rule"
        destructive
        onConfirm={() => deleting && void run(() => deleteRule(actor.id, deleting.id))}
      />
    </>
  );
}
