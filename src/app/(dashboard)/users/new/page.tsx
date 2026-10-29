import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { UserForm } from "@/features/access-control/components/user-form";

export default function InviteUserPage() {
  return (
    <RequirePermission permission="access.user.manage">
      <PageHeader title="Invite user" description="They get an email to set up their account." />
      <UserForm />
    </RequirePermission>
  );
}
