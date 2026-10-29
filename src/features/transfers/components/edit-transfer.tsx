"use client";

import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs";
import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { useCurrentUser } from "@/features/access-control/hooks/use-access";
import { useStore } from "@/lib/create-store";

import { actionBlocker, transfersStore } from "../api/transfers-api";
import { TransferForm } from "./transfer-form";

export function EditTransfer({ transferId }: { transferId: string }) {
  const transfer = useStore(transfersStore).find((candidate) => candidate.id === transferId);
  const { user: actor } = useCurrentUser();
  useBreadcrumbLabel(`/inventory/transfers/${transferId}`, transfer?.number);

  const blocker = transfer ? actionBlocker(actor.id, transfer, "edit") : "Transfer not found.";
  if (!transfer || blocker) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">This transfer can&apos;t be changed</h1>
        <p className="text-sm text-muted-foreground">{blocker}</p>
        <LinkButton href={transfer ? `/inventory/transfers/${transfer.id}` : "/inventory/transfers"} variant="outline" className="mt-2">
          Back
        </LinkButton>
      </div>
    );
  }
  return (
    <>
      <PageHeader title={`Edit ${transfer.number}`} description="Changes are recorded in the transfer's history." />
      <TransferForm key={transfer.id} transfer={transfer} />
    </>
  );
}
