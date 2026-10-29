"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";

import { setProductArchived } from "../api/products-api";
import type { Product } from "../types/product";

type ArchiveProductDialogProps = {
  // The product to archive or restore; null keeps the dialog closed.
  product: Product | null;
  onOpenChange: (open: boolean) => void;
};

export function ArchiveProductDialog({ product, onOpenChange }: ArchiveProductDialogProps) {
  const restoring = product?.status === "archived";
  const name = <span className="font-medium text-foreground">{product?.name}</span>;

  return (
    <ConfirmDialog
      open={product !== null}
      onOpenChange={onOpenChange}
      title={restoring ? "Restore product?" : "Archive product?"}
      description={
        restoring ? (
          <>{name} will be active again and appear in the product list, stock figures and alerts.</>
        ) : (
          <>
            {name} will be hidden from the product list, stock figures and alerts. Its history is kept and you can
            restore it at any time.
          </>
        )
      }
      confirmLabel={restoring ? "Restore" : "Archive"}
      onConfirm={() => {
        if (product) void setProductArchived(product.id, !restoring);
      }}
    />
  );
}
