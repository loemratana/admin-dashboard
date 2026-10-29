import { EditUser } from "@/features/access-control/components/edit-user";
import { RequirePermission } from "@/features/access-control/components/require-permission";

export default async function UserPage({ params }: PageProps<"/users/[userId]">) {
  const { userId } = await params;
  return (
    <RequirePermission permission="access.user.view">
      <EditUser userId={userId} />
    </RequirePermission>
  );
}
