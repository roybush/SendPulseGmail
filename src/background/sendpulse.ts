/**
 * SendPulse REST API client. Runs only in the service worker.
 * Docs: https://sendpulse.com/integrations/api, https://sendpulse.com/integrations/api/bulk-email
 */
import type { KeyValueStore } from './storage';
import type {
  AddressBook,
  AuthStatus,
  BookVariable,
  ChatbotSubscription,
  ContactStats,
  Credentials,
  CrmBoard,
  CrmContactInput,
  CrmPipeline,
  Membership,
  NewContact,
  NewDeal,
  NewTask,
  OptIn,
  Sender,
} from '../shared/types';

export const API_URL = 'https://api.sendpulse.com';

const CREDENTIALS_KEY = 'credentials';
const TOKEN_KEY = 'token';
// Refresh a bit before the real expiry so in-flight requests don't race it.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const PAGE_SIZE = 100;
// Returned by GET /emails/{email} when the address is in no address book.
const NO_SUCH_EMAIL_CODE = 502;
// CRM API: https://login.sendpulse.com/api/crm-service/v1/openapi/en
const CRM = '/crm/v1';
export const MAX_DEAL_CONTACTS = 5;
// Chatbot channels and their API roots: https://sendpulse.com/integrations/api/chatbot
const CHATBOT_CHANNELS = [
  { name: 'Telegram', path: '/telegram' },
  { name: 'Viber', path: '/viber/chatbots' },
  { name: 'WhatsApp', path: '/whatsapp' },
  { name: 'Instagram', path: '/instagram' },
  { name: 'Messenger', path: '/messenger' },
  { name: 'Live chat', path: '/live-chat' },
  { name: 'TikTok', path: '/tiktok' },
];
const CHATBOT_ACTIVE = 1;
const BOTS_CACHE_MS = 10 * 60_000;

type Token = { value: string; expiresAt: number };

/** Credentials saved before API key support had no `kind`. */
type StoredCredentials = Credentials | { kind?: undefined; clientId: string; clientSecret: string };

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

type CampaignStatsDto = {
  statistic?: { sent?: number; open?: number; link?: number };
  blacklist?: boolean;
};

type PipelineDto = {
  id: number;
  name: string;
  steps?: { id: number; name: string; order: number }[];
};

/** CRM endpoints wrap every payload. */
type CrmResponse<T> = { success: boolean; data: T };

type MembershipDto = {
  book_id: number | string;
  status: number | string;
  status_explain?: string;
  variables?: { name: string; value: string }[] | Record<string, string>;
};

type BotDto = { id: string; channel_data?: { name?: string; username?: string } };

export class SendPulseClient {
  /** Bots rarely change; looking up several people shouldn't refetch them every time. */
  private bots?: { at: number; list: { channel: string; path: string; id: string; name: string }[] };

  constructor(
    /** Long-lived: API key, or client id and secret needed to refresh the token silently. */
    private readonly credentialsStore: KeyValueStore,
    /** Short-lived: access token. */
    private readonly tokenStore: KeyValueStore,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  async login(credentials: Credentials): Promise<AuthStatus> {
    if (credentials.kind === 'apiKey') {
      const apiKey = credentials.apiKey.trim();
      if (!apiKey) throw new SendPulseError('API key is required', 400);
      // Any cheap authenticated call proves the key works.
      await parse(await this.send('GET', '/addressbooks?limit=1', `Bearer ${apiKey}`));
      await this.tokenStore.remove(TOKEN_KEY);
      await this.credentialsStore.set(CREDENTIALS_KEY, { kind: 'apiKey', apiKey });
      return this.status();
    }

    const clean = {
      kind: 'oauth' as const,
      clientId: credentials.clientId.trim(),
      clientSecret: credentials.clientSecret.trim(),
    };
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
    const credentials = await this.credentials();
    if (!credentials) return { loggedIn: false };
    return {
      loggedIn: true,
      method: credentials.kind,
      label: mask(credentials.kind === 'apiKey' ? credentials.apiKey : credentials.clientId),
    };
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

  /** With `optIn`, SendPulse sends each contact a confirmation email instead of adding them outright. */
  async addContacts(bookId: number, contacts: NewContact[], optIn?: OptIn): Promise<void> {
    await this.request('POST', `/addressbooks/${bookId}/emails`, {
      emails: contacts.map((c) => ({ email: c.email, variables: c.variables ?? {} })),
      ...(optIn && {
        confirmation: 'force',
        sender_email: optIn.senderEmail,
        message_lang: confirmationLang(optIn.lang),
      }),
    });
  }

  async removeContacts(bookId: number, emails: string[]): Promise<void> {
    await this.request('DELETE', `/addressbooks/${bookId}/emails`, { emails });
  }

  /** Overwrites the given variables of a contact already in the book (one email per call). */
  async updateVariables(bookId: number, email: string, variables: Record<string, string>): Promise<void> {
    await this.request('POST', `/addressbooks/${bookId}/emails/variable`, {
      email,
      variables: Object.entries(variables).map(([name, value]) => ({ name, value })),
    });
  }

  /** Active sender addresses; only these can send confirmation emails. */
  async listSenders(): Promise<Sender[]> {
    const rows = await this.request<{ name: string; email: string; status?: string }[]>('GET', '/senders');
    return rows
      .filter((s) => !s.status || /^active$/i.test(s.status))
      .map(({ name, email }) => ({ name, email }));
  }

  async unsubscribe(bookId: number, emails: string[]): Promise<void> {
    await this.request('POST', `/addressbooks/${bookId}/emails/unsubscribe`, { emails });
  }

  /** Sent / opened / clicked across all campaigns, and whether the address is blacklisted. */
  async contactStats(email: string): Promise<ContactStats> {
    try {
      const dto = await this.request<CampaignStatsDto>(
        'GET',
        `/emails/${encodeURIComponent(email)}/campaigns`,
      );
      return {
        sent: Number(dto.statistic?.sent ?? 0),
        opened: Number(dto.statistic?.open ?? 0),
        clicked: Number(dto.statistic?.link ?? 0),
        blacklisted: !!dto.blacklist,
      };
    } catch (e) {
      if (e instanceof SendPulseError && (e.code === NO_SUCH_EMAIL_CODE || e.status === 404)) {
        return { sent: 0, opened: 0, clicked: 0, blacklisted: false };
      }
      throw e;
    }
  }

  /** The blacklist API takes a Base64-encoded, comma-separated list. */
  async setBlacklisted(emails: string[], blacklisted: boolean): Promise<void> {
    await this.request(blacklisted ? 'POST' : 'DELETE', '/blacklist', { emails: base64(emails.join(',')) });
  }

  /** ID of the CRM contact with this email, if there is one. */
  async crmFindContact(email: string): Promise<number | null> {
    const res = await this.request<CrmResponse<{ list: { id: number; emails?: { email: string }[] }[] }>>(
      'POST',
      `${CRM}/contacts/get-list-by-email`,
      { email, isEmailFullSearch: true },
    );
    const wanted = email.toLowerCase();
    const match =
      res.data.list.find((c) => c.emails?.some((e) => e.email.toLowerCase() === wanted)) ?? res.data.list[0];
    return match?.id ?? null;
  }

  /** Finds the CRM contact by email or creates it with the given name and phone. */
  async crmEnsureContact(input: CrmContactInput): Promise<{ id: number; created: boolean }> {
    const existing = await this.crmFindContact(input.email);
    if (existing !== null) return { id: existing, created: false };

    const { data } = await this.request<CrmResponse<{ id: number }>>('POST', `${CRM}/contacts/create`, {
      firstName: input.firstName || null,
      lastName: input.lastName || null,
    });
    await this.request('POST', `${CRM}/contacts/${data.id}/emails`, {
      emails: [{ email: input.email, isMain: true }],
    });
    if (input.phone) await this.request('POST', `${CRM}/contacts/${data.id}/phones`, { phone: input.phone });
    return { id: data.id, created: true };
  }

  async crmPipelines(): Promise<CrmPipeline[]> {
    const { data } = await this.request<CrmResponse<PipelineDto[]>>('GET', `${CRM}/pipelines`);
    return data.map(withOrderedSteps);
  }

  /** Which of the account's chatbots this email is subscribed to, across all channels. */
  async chatbotSubscriptions(email: string): Promise<ChatbotSubscription[]> {
    const bots = await this.chatbots();
    const found = await Promise.all(
      bots.map(async (bot) => {
        const query = new URLSearchParams({ bot_id: bot.id, variable_name: 'email', variable_value: email });
        const res = await this.request<{ data?: { status: number }[] }>(
          'GET',
          `${bot.path}/contacts/getByVariable?${query}`,
        ).catch(() => ({ data: [] }));
        return (res.data ?? []).map((c) => ({
          channel: bot.channel,
          bot: bot.name,
          active: c.status === CHATBOT_ACTIVE,
        }));
      }),
    );
    return found.flat();
  }

  private async chatbots() {
    if (this.bots && this.now() - this.bots.at < BOTS_CACHE_MS) return this.bots.list;
    // A channel the account doesn't use may answer with an error; that just means no bots.
    const perChannel = await Promise.all(
      CHATBOT_CHANNELS.map(async ({ name, path }) => {
        const res = await this.request<{ data?: BotDto[] }>('GET', `${path}/bots`).catch(() => ({
          data: [],
        }));
        return (res.data ?? []).map((b) => ({
          channel: name,
          path,
          id: b.id,
          name: b.channel_data?.name || b.channel_data?.username || b.id,
        }));
      }),
    );
    this.bots = { at: this.now(), list: perChannel.flat() };
    return this.bots.list;
  }

  async crmAddComment(contactId: number, message: string): Promise<void> {
    await this.request('POST', `${CRM}/contacts/${contactId}/comments`, { message });
  }

  async crmBoards(): Promise<CrmBoard[]> {
    // The list comes double-wrapped: { success, data: { data: [...] } }.
    const { data } = await this.request<CrmResponse<PipelineDto[] | { data: PipelineDto[] }>>(
      'GET',
      `${CRM}/boards`,
    );
    return (Array.isArray(data) ? data : data.data).map(withOrderedSteps);
  }

  async crmCreateTask(task: NewTask): Promise<{ id: number }> {
    const { data } = await this.request<CrmResponse<{ id: number }>>('POST', `${CRM}/tasks`, {
      boardId: task.boardId,
      stepId: task.stepId,
      priority: 1,
      name: task.name,
      description: task.description ?? null,
      finishAt: task.finishAt,
      connections: { contactIds: task.contactIds },
    });
    return { id: data.id };
  }

  /** Creates a deal and links its contacts, creating missing CRM contacts first. */
  async crmCreateDeal(deal: NewDeal): Promise<{ id: number }> {
    const contacts = [];
    for (const c of deal.contacts.slice(0, MAX_DEAL_CONTACTS))
      contacts.push((await this.crmEnsureContact(c)).id);
    const { data } = await this.request<CrmResponse<{ id: number }>>('POST', `${CRM}/deals`, {
      pipelineId: deal.pipelineId,
      stepId: deal.stepId,
      name: deal.name,
      contact: contacts,
    });
    return { id: data.id };
  }

  private async request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const credentials = await this.credentials();
    if (!credentials) throw new SendPulseError('Not logged in to SendPulse', 401);
    const authorization =
      credentials.kind === 'apiKey' ? `Bearer ${credentials.apiKey}` : await this.token(credentials);

    const res = await this.send(method, path, authorization, body);
    // A token can be revoked or expire early: get a fresh one once. API keys can't be refreshed.
    if (res.status === 401 && credentials.kind === 'oauth' && !retried) {
      await this.tokenStore.remove(TOKEN_KEY);
      return this.request<T>(method, path, body, true);
    }
    return parse<T>(res);
  }

  private send(method: string, path: string, authorization: string, body?: unknown): Promise<Response> {
    return this.fetchFn(API_URL + path, {
      method,
      headers: {
        Authorization: authorization,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async credentials(): Promise<Credentials | undefined> {
    const stored = await this.credentialsStore.get<StoredCredentials>(CREDENTIALS_KEY);
    if (!stored) return undefined;
    return stored.kind ? stored : { ...stored, kind: 'oauth' };
  }

  private async token(credentials: Extract<Credentials, { kind: 'oauth' }>): Promise<string> {
    const cached = await this.tokenStore.get<Token>(TOKEN_KEY);
    if (cached && cached.expiresAt - TOKEN_EXPIRY_MARGIN_MS > this.now()) return cached.value;

    const token = await this.requestToken(credentials);
    await this.tokenStore.set(TOKEN_KEY, token);
    return token.value;
  }

  private async requestToken({
    clientId,
    clientSecret,
  }: Extract<Credentials, { kind: 'oauth' }>): Promise<Token> {
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

/** "sp_apikey_123456789abcdef" -> "sp_apikey_…bcdef": enough to recognise, useless to steal. */
export function mask(secret: string): string {
  const prefix = secret.match(/^sp_[a-z]+_/i)?.[0] ?? '';
  return `${prefix}…${secret.slice(-5)}`;
}

/** Pipelines and task boards share a shape: columns ("steps") with an order. */
function withOrderedSteps(p: PipelineDto) {
  return {
    id: p.id,
    name: p.name,
    steps: [...(p.steps ?? [])].sort((a, b) => a.order - b.order).map(({ id, name }) => ({ id, name })),
  };
}

/** SendPulse has confirmation emails in these languages only; it calls Ukrainian "ua". */
const CONFIRMATION_LANGS: Record<string, string> = {
  en: 'en',
  ru: 'ru',
  uk: 'ua',
  tr: 'tr',
  es: 'es',
  pt: 'pt',
};

export function confirmationLang(uiLang: string): string {
  return CONFIRMATION_LANGS[uiLang.toLowerCase().split(/[-_]/)[0]] ?? 'en';
}

/** btoa only takes Latin-1; addresses can have Unicode in them. */
function base64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function normalizeVariables(vars: MembershipDto['variables']): Record<string, string> {
  if (!vars) return {};
  if (Array.isArray(vars)) return Object.fromEntries(vars.map((v) => [v.name, v.value ?? '']));
  return { ...vars };
}
