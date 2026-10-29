import { UserPlus } from "lucide-react";

import { LinkButton } from "@/components/shared/link-button";
import { PageHeader } from "@/components/shared/page-header";
import { Can } from "@/features/access-control/components/can";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { UsersTable } from "@/features/access-control/components/users-table";

export default function UsersPage() {
  return (
    <RequirePermission permission="access.user.view">
      <PageHeader
        title="Users"
        description="Who can sign in, their roles and the warehouses they work in."
        actions={
          <Can permission="access.user.manage">
            <LinkButton href="/users/new">
              <UserPlus data-icon="inline-start" />
              Invite user
            </LinkButton>
          </Can>
        }
      />
      <UsersTable />
    </RequirePermission>
  );
}
