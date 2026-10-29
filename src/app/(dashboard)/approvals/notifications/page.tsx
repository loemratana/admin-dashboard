import { RequirePermission } from "@/features/access-control/components/require-permission";
import { NotificationOutbox } from "@/features/notifications/components/notification-outbox";

export default function NotificationsPage() {
  return (
    <RequirePermission permission="approvals.notification.view">
      <NotificationOutbox />
    </RequirePermission>
  );
}
