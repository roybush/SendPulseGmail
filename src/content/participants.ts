/** Pure helpers for turning Gmail message headers into contacts. No DOM, no InboxSDK. */
import { parseSignature, type ContactDetails, type SignatureSource } from './signature';

export type Address = { emailAddress: string; name?: string };

export type MessageHeaders = {
  sender: Address;
  recipients: Address[];
  /** The sender's own text (quotes removed), for reading their signature. */
  signature?: SignatureSource;
};

export type Participant = {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  /** Sent at least one message in the thread (vs. only received). */
  isSender: boolean;
  /** Found in their signatures; later messages win. */
  details: ContactDetails;
  /** noreply@, notifications@…: a robot, not a person. */
  automated: boolean;
};

const AUTOMATED_WORDS =
  'no-?reply|do-?not-?reply|notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?|newsletters?|digest|updates|automated';
const AUTOMATED = new RegExp(`(^|[+._-])(${AUTOMATED_WORDS})([+._-]|$)`, 'i');

export function isAutomated(email: string): boolean {
  return AUTOMATED.test(email.split('@')[0] ?? '');
}

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
  const byEmail = new Map<
    string,
    { email: string; name: string; isSender: boolean; order: number; signatures: SignatureSource[] }
  >();

  const add = (address: Address, isSender: boolean, signature?: SignatureSource) => {
    const email = address.emailAddress.trim();
    const key = email.toLowerCase();
    if (!key || key === self) return;
    let entry = byEmail.get(key);
    if (!entry) {
      entry = { email, name: '', isSender: false, order: byEmail.size, signatures: [] };
      byEmail.set(key, entry);
    }
    entry.isSender ||= isSender;
    if (!entry.name && address.name) entry.name = address.name;
    if (signature) entry.signatures.push(signature);
  };

  for (const m of messages) {
    add(m.sender, true, m.signature);
    m.recipients.forEach((r) => add(r, false));
  }

  return [...byEmail.values()]
    .map((p) => ({ ...p, automated: isAutomated(p.email) }))
    .sort(
      (a, b) =>
        Number(a.automated) - Number(b.automated) ||
        Number(b.isSender) - Number(a.isSender) ||
        a.order - b.order,
    )
    .map(({ email, name, isSender, signatures, automated }) => ({
      email,
      name,
      isSender,
      automated,
      // A robot's display name ("LinkedIn") and footer aren't a person's name and contacts.
      ...(automated ? { firstName: '', lastName: '' } : splitName(name, email)),
      details: automated
        ? {}
        : Object.assign({}, ...signatures.map((s) => parseSignature(s, { email, name }))),
    }));
}
