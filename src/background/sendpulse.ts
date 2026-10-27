/**
 * SendPulse REST API client. Runs only in the service worker.
 * Docs: https://sendpulse.com/integrations/api, https://sendpulse.com/integrations/api/bulk-email
 */
import type { KeyValueStore } from './storage';
import type {
  AddressBook,
  AuthStatus,
  BookVariable,
  Credentials,
  Membership,
  NewContact,
} from '../shared/types';

export const API_URL = 'https://api.sendpulse.com';

const CREDENTIALS_KEY = 'credentials';
const TOKEN_KEY = 'token';
// Refresh a bit before the real expiry so in-flight requests don't race it.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const PAGE_SIZE = 100;
// Returned by GET /emails/{email} when the address is in no address book.
const NO_SUCH_EMAIL_CODE = 502;

type Token = { value: string; expiresAt: number };

export class SendPulseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'SendPulseError';
  }
}

type ErrorBody = { message?: string; error_description?: string; error_code?: number };

type AddressBookDto = {
  id: number;
  name: string;
  all_email_qty: number;
  active_email_qty: number;
};

type MembershipDto = {
  book_id: number | string;
  status: number | string;
  status_explain?: string;
  variables?: { name: string; value: string }[] | Record<string, string>;
};

export class SendPulseClient {
  constructor(
    /** Long-lived: client id and secret, needed to refresh the token silently. */
    private readonly credentialsStore: KeyValueStore,
    /** Short-lived: access token. */
    private readonly tokenStore: KeyValueStore,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  async login(credentials: Credentials): Promise<AuthStatus> {
    const clean = { clientId: credentials.clientId.trim(), clientSecret: credentials.clientSecret.trim() };
    if (!clean.clientId || !clean.clientSecret) {
      throw new SendPulseError('Client ID and Client Secret are required', 400);
    }
    const token = await this.requestToken(clean);
    await this.credentialsStore.set(CREDENTIALS_KEY, clean);
    await this.tokenStore.set(TOKEN_KEY, token);
    return this.status();
  }

  async logout(): Promise<AuthStatus> {
    await this.credentialsStore.remove(CREDENTIALS_KEY);
    await this.tokenStore.remove(TOKEN_KEY);
    return { loggedIn: false };
  }

  async status(): Promise<AuthStatus> {
    const credentials = await this.credentialsStore.get<Credentials>(CREDENTIALS_KEY);
    return credentials
      ? { loggedIn: true, clientIdPrefix: credentials.clientId.slice(0, 8) }
      : { loggedIn: false };
  }

  async listAddressBooks(): Promise<AddressBook[]> {
    const books: AddressBook[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.request<AddressBookDto[]>(
        'GET',
        `/addressbooks?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      books.push(
        ...page.map((b) => ({
          id: b.id,
          name: b.name,
          totalEmails: b.all_email_qty,
          activeEmails: b.active_email_qty,
        })),
      );
      if (page.length < PAGE_SIZE) return books;
    }
  }

  async listBookVariables(bookId: number): Promise<BookVariable[]> {
    const vars = await this.request<BookVariable[]>('GET', `/addressbooks/${bookId}/variables`);
    return vars.map(({ name, type }) => ({ name, type }));
  }

  /** Address books that contain this email. Empty if it is in none. */
  async findContact(email: string): Promise<Membership[]> {
    try {
      const rows = await this.request<MembershipDto[]>('GET', `/emails/${encodeURIComponent(email)}`);
      return rows.map((r) => ({
        bookId: Number(r.book_id),
        status: r.status_explain ?? String(r.status),
        variables: normalizeVariables(r.variables),
      }));
    } catch (e) {
      if (e instanceof SendPulseError && (e.code === NO_SUCH_EMAIL_CODE || e.status === 404)) return [];
      throw e;
    }
  }

  async addContacts(bookId: number, contacts: NewContact[]): Promise<void> {
    await this.request('POST', `/addressbooks/${bookId}/emails`, {
      emails: contacts.map((c) => ({ email: c.email, variables: c.variables ?? {} })),
    });
  }

  async unsubscribe(bookId: number, emails: string[]): Promise<void> {
    await this.request('POST', `/addressbooks/${bookId}/emails/unsubscribe`, { emails });
  }

  private async request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const token = await this.token();
    const res = await this.fetchFn(API_URL + path, {
      method,
      headers: {
        Authorization: token,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Token revoked or expired early: get a fresh one once.
    if (res.status === 401 && !retried) {
      await this.tokenStore.remove(TOKEN_KEY);
      return this.request<T>(method, path, body, true);
    }
    return parse<T>(res);
  }

  private async token(): Promise<string> {
    const cached = await this.tokenStore.get<Token>(TOKEN_KEY);
    if (cached && cached.expiresAt - TOKEN_EXPIRY_MARGIN_MS > this.now()) return cached.value;

    const credentials = await this.credentialsStore.get<Credentials>(CREDENTIALS_KEY);
    if (!credentials) throw new SendPulseError('Not logged in to SendPulse', 401);
    const token = await this.requestToken(credentials);
    await this.tokenStore.set(TOKEN_KEY, token);
    return token.value;
  }

  private async requestToken({ clientId, clientSecret }: Credentials): Promise<Token> {
    const res = await this.fetchFn(`${API_URL}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const data = await parse<{ access_token: string; token_type: string; expires_in: number }>(res);
    if (!data.access_token || !data.expires_in) {
      throw new SendPulseError('SendPulse did not return an access token', res.status);
    }
    return {
      value: `${data.token_type || 'Bearer'} ${data.access_token}`,
      expiresAt: this.now() + data.expires_in * 1000,
    };
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new SendPulseError(`Unexpected response from SendPulse (HTTP ${res.status})`, res.status);
  }
  if (!res.ok) {
    const err = (data ?? {}) as ErrorBody;
    const message = err.message || err.error_description || `SendPulse request failed (HTTP ${res.status})`;
    throw new SendPulseError(message, res.status, err.error_code);
  }
  return data as T;
}

function normalizeVariables(vars: MembershipDto['variables']): Record<string, string> {
  if (!vars) return {};
  if (Array.isArray(vars)) return Object.fromEntries(vars.map((v) => [v.name, v.value ?? '']));
  return { ...vars };
}
