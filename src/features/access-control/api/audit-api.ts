import { permissionLabel, type PermissionKey } from "@/config/permissions";
import { createStore } from "@/lib/create-store";
import { onEvent } from "@/lib/events";

import { usersStore } from "./access-api";

export type AuditEntry = {
  id: string;
  at: string; // ISO date-time
  type:
    | "access.denied"
    | "session.switched"
    | "role.created"
    | "role.updated"
    | "role.deleted"
    | "user.invited"
    | "user.updated"
    | "user.disabled"
    | "user.enabled"
    | "user.inviteResent"
    | "warehouse.changed"
    | "product.variantsChanged"
    | "stock.adjustmentDecided"
    | "stock.transferChanged"
    | "stock.countChanged"
    | "approval.decided"
    | "approval.ruleChanged";
  actorId: string;
  // The user an action was done to, for per-user activity.
  targetId?: string;
  summary: string;
  permission?: PermissionKey;
};

// In memory until the backend exists; the audit screen (step 4) reads this.
export const auditStore = createStore<AuditEntry[]>([]);

let sequence = 0;
function record(entry: Omit<AuditEntry, "id" | "at">) {
  sequence += 1;
  const full = { ...entry, id: `audit-${sequence}`, at: new Date().toISOString() };
  auditStore.setState((entries) => [full, ...entries]);
}

// Observer: the audit log listens for events; emitters don't know it exists.
onEvent("access.denied", ({ userId, permission, path }) =>
  record({
    type: "access.denied",
    actorId: userId,
    permission,
    summary: `Denied ${path}: missing "${permissionLabel(permission)}"`,
  }),
);

const userName = (id: string) => usersStore.getState().find((user) => user.id === id)?.name ?? id;

onEvent("session.switched", ({ fromUserId, toUserId }) =>
  record({ type: "session.switched", actorId: fromUserId, summary: `Switched view to ${userName(toUserId)}` }),
);

const roleVerbs = { "role.created": "Created", "role.updated": "Updated", "role.deleted": "Deleted" } as const;
for (const type of ["role.created", "role.updated", "role.deleted"] as const) {
  onEvent(type, ({ actorId, roleName, detail }) =>
    record({ type, actorId, summary: `${roleVerbs[type]} role "${roleName}" (${detail})` }),
  );
}

const userVerbs = {
  "user.invited": "Invited",
  "user.updated": "Updated",
  "user.disabled": "Disabled",
  "user.enabled": "Re-enabled",
  "user.inviteResent": "Resent invite to",
} as const;
for (const type of ["user.invited", "user.updated", "user.disabled", "user.enabled", "user.inviteResent"] as const) {
  onEvent(type, ({ actorId, userId, userName, detail }) =>
    record({ type, actorId, targetId: userId, summary: `${userVerbs[type]} ${userName}${detail ? ` (${detail})` : ""}` }),
  );
}

onEvent("warehouse.changed", ({ actorId, summary }) => record({ type: "warehouse.changed", actorId, summary }));
onEvent("product.variantsChanged", ({ actorId, summary }) => record({ type: "product.variantsChanged", actorId, summary }));
onEvent("stock.adjustmentDecided", ({ actorId, summary }) => record({ type: "stock.adjustmentDecided", actorId, summary }));
onEvent("stock.transferChanged", ({ actorId, summary }) => record({ type: "stock.transferChanged", actorId, summary }));
onEvent("stock.countChanged", ({ actorId, summary }) => record({ type: "stock.countChanged", actorId, summary }));
onEvent("approval.decided", ({ actorId, summary }) => record({ type: "approval.decided", actorId, summary }));
onEvent("approval.ruleChanged", ({ actorId, summary }) => record({ type: "approval.ruleChanged", actorId, summary }));
