import { Plus } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { Can } from "@/features/access-control/components/can";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { RolesTable } from "@/features/access-control/components/roles-table";

export default function RolesPage() {
  return (
    <RequirePermission permission="access.role.view">
      <PageHeader
        title="Roles"
        description="What each role can do. System roles are protected; clone one to customize it."
        actions={
          <Can permission="access.role.manage">
            <LinkButton href="/roles/new">
              <Plus data-icon="inline-start" />
              New role
            </LinkButton>
          </Can>
        }
      />
      <RolesTable />
    </RequirePermission>
  );
}
