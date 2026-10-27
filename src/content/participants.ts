/** Pure helpers for turning Gmail message headers into contacts. No DOM, no InboxSDK. */

export type Address = { emailAddress: string; name?: string };

export type MessageHeaders = { sender: Address; recipients: Address[] };

export type Participant = {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  /** Sent at least one message in the thread (vs. only received). */
  isSender: boolean;
};

// Company senders often use their site as the display name ("Equipment.com.ua").
const DOMAIN = /^[\p{L}\d-]+(\.[\p{L}\d-]+)+$/u;

export function splitName(
  rawName: string | undefined,
  email: string,
): { firstName: string; lastName: string } {
  let name = (rawName ?? '')
    .replace(/["'`]/g, '')
    .replace(/\s*\(.*?\)\s*/g, ' ') // "Ann Lee (Acme)" -> "Ann Lee"
    .replace(/\s+/g, ' ')
    .trim();
  // Gmail falls back to the address (or its exact local part) when there's no display name.
  if (!name || name.includes('@') || name === email.split('@')[0] || DOMAIN.test(name)) {
    return { firstName: '', lastName: '' };
  }
  // "Lee, Ann" -> "Ann Lee"
  const comma = name.match(/^([^,]+),\s*(.+)$/);
  if (comma) name = `${comma[2]} ${comma[1]}`;

  const [firstName, ...rest] = name.split(' ');
  return { firstName, lastName: rest.join(' ') };
}

/**
 * Unique people in a thread, excluding the current user.
 * Senders come first; a display name from any message wins over a bare address.
 */
export function collectParticipants(messages: MessageHeaders[], selfEmail: string): Participant[] {
  const self = selfEmail.toLowerCase();
  const byEmail = new Map<string, { email: string; name: string; isSender: boolean; order: number }>();

  const add = (address: Address, isSender: boolean) => {
    const email = address.emailAddress.trim();
    const key = email.toLowerCase();
    if (!key || key === self) return;
    const existing = byEmail.get(key);
    if (existing) {
      existing.isSender ||= isSender;
      if (!existing.name && address.name) existing.name = address.name;
    } else {
      byEmail.set(key, { email, name: address.name ?? '', isSender, order: byEmail.size });
    }
  };

  for (const m of messages) {
    add(m.sender, true);
    m.recipients.forEach((r) => add(r, false));
  }

  return [...byEmail.values()]
    .sort((a, b) => Number(b.isSender) - Number(a.isSender) || a.order - b.order)
    .map(({ email, name, isSender }) => ({ email, name, isSender, ...splitName(name, email) }));
}
