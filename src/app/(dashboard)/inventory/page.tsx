import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { Can } from "@/features/access-control/components/can";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { StockOverview } from "@/features/stock/components/stock-overview";

export default function StockOverviewPage() {
  return (
    <RequirePermission permission="inventory.stock.view">
      <PageHeader
        title="Stock overview"
        description="What you hold, by item. On hand = available + reserved + damaged."
        actions={
          <>
            <Can permission="inventory.movement.issue">
              <LinkButton href="/inventory/issue" variant="outline">
                <ArrowUpFromLine data-icon="inline-start" />
                Stock out
              </LinkButton>
            </Can>
            <Can permission="inventory.movement.receive">
              <LinkButton href="/inventory/receive">
                <ArrowDownToLine data-icon="inline-start" />
                Stock in
              </LinkButton>
            </Can>
          </>
        }
      />
      <StockOverview />
    </RequirePermission>
  );
}
