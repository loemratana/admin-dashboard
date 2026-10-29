import { usersStore } from "@/features/access-control/api/access-api";
import { createStore } from "@/lib/create-store";
import type { User } from "@/types/access";

// Outgoing notifications. Each channel is a provider with one job: deliver a
// message to an address. Until a backend holds the SMTP and Telegram bot
// credentials, the providers here only record what would have been sent;
// swap them for real ones without touching the callers.

export type NotificationChannel = "email" | "telegram";

export type Notification = {
  id: string;
  at: string;
  channel: NotificationChannel;
  recipientId: string;
  address: string; // email address or Telegram username
  subject: string;
  body: string;
  href: string; // where the message links to in the app
  status: "simulated" | "sent" | "failed";
};

export type OutgoingMessage = { subject: string; body: string; href: string };

type ChannelProvider = {
  channel: NotificationChannel;
  addressOf: (user: User) => string | null;
  deliver: (address: string, message: OutgoingMessage) => Notification["status"];
};

const simulated = (): Notification["status"] => "simulated";

const providers: ChannelProvider[] = [
  { channel: "email", addressOf: (user) => user.email || null, deliver: simulated },
  { channel: "telegram", addressOf: (user) => user.telegram || null, deliver: simulated },
];

export const outboxStore = createStore<Notification[]>([]);

let sequence = 0;

// Sends to every channel each recipient has an address for. Never throws:
// a failed notification mustn't undo the action that triggered it.
export function notify(recipientIds: string[], message: OutgoingMessage) {
  const users = usersStore.getState();
  const at = new Date().toISOString();
  const sent: Notification[] = [];
  for (const recipientId of new Set(recipientIds)) {
    const user = users.find((candidate) => candidate.id === recipientId);
    if (!user || user.status !== "active") continue;
    for (const provider of providers) {
      const address = provider.addressOf(user);
      if (!address) continue;
      let status: Notification["status"];
      try {
        status = provider.deliver(address, message);
      } catch {
        status = "failed";
      }
      sent.push({ id: `ntf-${++sequence}`, at, channel: provider.channel, recipientId, address, ...message, status });
    }
  }
  if (sent.length > 0) outboxStore.setState((list) => [...sent, ...list]);
  return sent;
}
