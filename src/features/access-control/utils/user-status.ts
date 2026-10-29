import type { StatusTone } from "@/components/shared/status-badge";
import type { UserStatus } from "@/types/access";

export const userStatusDisplay: Record<UserStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invite pending", tone: "info" },
  disabled: { label: "Disabled", tone: "neutral" },
};
