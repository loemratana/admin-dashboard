import { PackageX } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";

export function ProductNotFound() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-16 text-center">
      <PackageX aria-hidden="true" className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Product not found</h1>
      <p className="text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <LinkButton href="/products" variant="outline" className="mt-2">
        Back to products
      </LinkButton>
    </div>
  );
}
