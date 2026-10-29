import { EditRole } from "@/features/access-control/components/edit-role";
import { RequirePermission } from "@/features/access-control/components/require-permission";

export default async function RolePage({ params }: PageProps<"/roles/[roleId]">) {
  const { roleId } = await params;
  return (
    <RequirePermission permission="access.role.view">
      <EditRole roleId={roleId} />
    </RequirePermission>
  );
}
