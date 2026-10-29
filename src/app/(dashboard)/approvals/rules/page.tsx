import { RequirePermission } from "@/features/access-control/components/require-permission";
import { RulesManager } from "@/features/approvals/components/rules-manager";

export default function ApprovalRulesPage() {
  return (
    <RequirePermission permission="approvals.rule.view">
      <RulesManager />
    </RequirePermission>
  );
}
