import { RequirePermission } from "@/features/access-control/components/require-permission";
import { RoleEditor } from "@/features/access-control/components/role-editor";

export default function NewRolePage() {
  return (
    <RequirePermission permission="access.role.manage">
      <RoleEditor />
    </RequirePermission>
  );
}
