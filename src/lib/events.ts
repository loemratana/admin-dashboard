import type { PermissionKey } from "@/config/permissions";

// App-wide events (Observer pattern). Features emit what happened; listeners such
// as the audit log react without the emitter knowing about them.
export type AppEvents = {
  "access.denied": { userId: string; permission: PermissionKey; path: string };
  "session.switched": { fromUserId: string; toUserId: string };
  "role.created": { actorId: string; roleId: string; roleName: string; detail: string };
  "role.updated": { actorId: string; roleId: string; roleName: string; detail: string };
  "role.deleted": { actorId: string; roleId: string; roleName: string; detail: string };
  "user.invited": { actorId: string; userId: string; userName: string; detail: string };
  "user.updated": { actorId: string; userId: string; userName: string; detail: string };
  "user.disabled": { actorId: string; userId: string; userName: string; detail: string };
  "user.enabled": { actorId: string; userId: string; userName: string; detail: string };
  "user.inviteResent": { actorId: string; userId: string; userName: string; detail: string };
  "warehouse.changed": { actorId: string; warehouseId: string; summary: string };
  "product.variantsChanged": { actorId: string; productId: string; summary: string };
  "stock.adjustmentDecided": { actorId: string; summary: string };
  "stock.transferChanged": { actorId: string; summary: string };
  "stock.countChanged": { actorId: string; summary: string };
  "approval.decided": { actorId: string; summary: string };
  "approval.ruleChanged": { actorId: string; summary: string };
};

type Listener<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

// Typed at the onEvent/emitEvent boundary; stored loosely inside.
const listeners = new Map<keyof AppEvents, Set<(payload: unknown) => void>>();

export function onEvent<K extends keyof AppEvents>(type: K, listener: Listener<K>) {
  const set = listeners.get(type) ?? new Set();
  listeners.set(type, set);
  const untyped = listener as (payload: unknown) => void;
  set.add(untyped);
  return () => set.delete(untyped);
}

export function emitEvent<K extends keyof AppEvents>(type: K, payload: AppEvents[K]) {
  listeners.get(type)?.forEach((listener) => listener(payload));
}
