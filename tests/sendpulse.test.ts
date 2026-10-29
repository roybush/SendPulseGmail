import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_URL,
  confirmationLang,
  mask,
  SendPulseClient,
  SendPulseError,
} from '../src/background/sendpulse';
import { memoryStore, type KeyValueStore } from '../src/background/storage';

const CREDS = {
  kind: 'oauth' as const,
  clientId: 'sp_id_FAKE_client_id_12345',
  clientSecret: 'FAKE_secret',
};
const API_KEY = 'sp_apikey_FAKE_key_99999';
const TOKEN_RESPONSE = { access_token: 'tok1', token_type: 'Bearer', expires_in: 3600 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

type Route = (url: string, init: RequestInit) => Response | undefined;

describe('SendPulseClient', () => {
  let credentials: KeyValueStore;
  let tokens: KeyValueStore;
  let now: number;
  let routes: Route[];
  let fetchFn: ReturnType<typeof vi.fn>;

  function client() {
    return new SendPulseClient(credentials, tokens, fetchFn as unknown as typeof fetch, () => now);
  }

  function on(method: string, path: string, respond: (init: RequestInit) => Response) {
    routes.push((url, init) =>
      url === API_URL + path && init.method === method ? respond(init) : undefined,
    );
  }

  function requestsTo(path: string) {
    return fetchFn.mock.calls.filter(([url]) => url === API_URL + path);
  }

  beforeEach(() => {
    credentials = memoryStore();
    tokens = memoryStore();
    now = 1_000_000;
    routes = [];
    fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      for (const route of routes) {
        const res = route(url, init);
        if (res) return res;
      }
      throw new Error(`Unexpected request ${init.method} ${url}`);
    });
    on('POST', '/oauth/access_token', () => json(TOKEN_RESPONSE));
  });

  describe('login', () => {
    it('exchanges credentials for a token and stores both', async () => {
      const status = await client().login(CREDS);

      expect(status).toEqual({ loggedIn: true, method: 'oauth', label: 'sp_id_…12345' });
      const body = JSON.parse(requestsTo('/oauth/access_token')[0][1].body);
      expect(body).toEqual({
        grant_type: 'client_credentials',
        client_id: CREDS.clientId,
        client_secret: CREDS.clientSecret,
      });
      expect(await credentials.get('credentials')).toEqual(CREDS);
      expect(await tokens.get('token')).toEqual({ value: 'Bearer tok1', expiresAt: now + 3600_000 });
    });

    it('reports invalid credentials and stores nothing', async () => {
      routes = [];
      on('POST', '/oauth/access_token', () =>
        json({ error: 'invalid_client', message: 'Client authentication failed.', error_code: 1 }, 401),
      );

      await expect(client().login(CREDS)).rejects.toThrow('Client authentication failed.');
      expect(await credentials.get('credentials')).toBeUndefined();
    });

    it('rejects empty credentials without calling the API', async () => {
      await expect(client().login({ kind: 'oauth', clientId: ' ', clientSecret: '' })).rejects.toBeInstanceOf(
        SendPulseError,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('API key', () => {
    beforeEach(() => {
      on('GET', '/addressbooks?limit=1', (init) =>
        (init.headers as Record<string, string>).Authorization === `Bearer ${API_KEY}`
          ? json([])
          : json({ message: 'Invalid API key' }, 401),
      );
      on('GET', '/addressbooks/1/variables', () => json([]));
    });

    it('checks the key, stores it and uses it directly', async () => {
      const c = client();
      expect(await c.login({ kind: 'apiKey', apiKey: ` ${API_KEY} ` })).toEqual({
        loggedIn: true,
        method: 'apiKey',
        label: 'sp_apikey_…99999',
      });
      await c.listBookVariables(1);

      expect(requestsTo('/oauth/access_token')).toHaveLength(0);
      expect(requestsTo('/addressbooks/1/variables')[0][1].headers).toMatchObject({
        Authorization: `Bearer ${API_KEY}`,
      });
      expect(await credentials.get('credentials')).toEqual({ kind: 'apiKey', apiKey: API_KEY });
    });

    it('rejects a wrong key and stores nothing', async () => {
      await expect(client().login({ kind: 'apiKey', apiKey: 'sp_apikey_WRONG' })).rejects.toThrow(
        'Invalid API key',
      );
      expect(await credentials.get('credentials')).toBeUndefined();
    });

    it('does not retry a revoked key', async () => {
      const c = client();
      await c.login({ kind: 'apiKey', apiKey: API_KEY });
      routes = [];
      on('GET', '/addressbooks/1/variables', () => json({ message: 'Invalid API key' }, 401));

      await expect(c.listBookVariables(1)).rejects.toThrow('Invalid API key');
      expect(requestsTo('/addressbooks/1/variables')).toHaveLength(1);
    });

    it('replaces previous client credentials and their token', async () => {
      const c = client();
      await c.login(CREDS);
      await c.login({ kind: 'apiKey', apiKey: API_KEY });

      expect(await tokens.get('token')).toBeUndefined();
      expect(await c.status()).toMatchObject({ loggedIn: true, method: 'apiKey' });
    });
  });

  it('keeps working with credentials saved before API key support', async () => {
    await credentials.set('credentials', { clientId: CREDS.clientId, clientSecret: CREDS.clientSecret });
    on('GET', '/addressbooks/1/variables', () => json([]));

    expect(await client().status()).toEqual({ loggedIn: true, method: 'oauth', label: 'sp_id_…12345' });
    await expect(client().listBookVariables(1)).resolves.toEqual([]);
  });

  it.each([
    ['sp_apikey_FAKE_abcdef', 'sp_apikey_…bcdef'],
    ['sp_id_FAKEabcdef', 'sp_id_…bcdef'],
    ['FAKEFAKEFAKEabcdef', '…bcdef'],
  ])('masks %s', (secret, masked) => {
    expect(mask(secret)).toBe(masked);
  });

  describe('tokens', () => {
    beforeEach(() => {
      on('GET', '/addressbooks/1/variables', () => json([{ name: 'name', type: 'string' }]));
    });

    it('fails clearly when not logged in', async () => {
      await expect(client().listBookVariables(1)).rejects.toThrow('Not logged in');
    });

    it('reuses a valid token', async () => {
      const c = client();
      await c.login(CREDS);
      await c.listBookVariables(1);
      await c.listBookVariables(1);

      expect(requestsTo('/oauth/access_token')).toHaveLength(1);
      expect(requestsTo('/addressbooks/1/variables')[0][1].headers).toMatchObject({
        Authorization: 'Bearer tok1',
      });
    });

    it('refreshes the token silently once it is about to expire', async () => {
      const c = client();
      await c.login(CREDS);
      now += 3600_000 - 30_000; // inside the safety margin

      await c.listBookVariables(1);
      expect(requestsTo('/oauth/access_token')).toHaveLength(2);
    });

    it('retries once with a fresh token on 401', async () => {
      const c = client();
      await c.login(CREDS);
      routes = [];
      let calls = 0;
      on('POST', '/oauth/access_token', () => json(TOKEN_RESPONSE));
      on('GET', '/addressbooks/1/variables', () =>
        ++calls === 1 ? json({ error: 'access_denied', message: 'denied' }, 401) : json([]),
      );

      await expect(c.listBookVariables(1)).resolves.toEqual([]);
      expect(calls).toBe(2);
    });

    it('does not loop on persistent 401', async () => {
      const c = client();
      await c.login(CREDS);
      routes = [];
      on('POST', '/oauth/access_token', () => json(TOKEN_RESPONSE));
      on('GET', '/addressbooks/1/variables', () => json({ message: 'denied' }, 401));

      await expect(c.listBookVariables(1)).rejects.toThrow('denied');
      expect(requestsTo('/addressbooks/1/variables')).toHaveLength(2);
    });
  });

  describe('API calls', () => {
    beforeEach(async () => {
      await client().login(CREDS);
    });

    it('lists address books across pages', async () => {
      const book = (id: number) => ({ id, name: `Book ${id}`, all_email_qty: 3, active_email_qty: 1 });
      on('GET', '/addressbooks?limit=100&offset=0', () =>
        json(Array.from({ length: 100 }, (_, i) => book(i))),
      );
      on('GET', '/addressbooks?limit=100&offset=100', () => json([book(100)]));

      const books = await client().listAddressBooks();
      expect(books).toHaveLength(101);
      expect(books[100]).toEqual({ id: 100, name: 'Book 100', totalEmails: 3, activeEmails: 1 });
    });

    it('finds the books a contact belongs to', async () => {
      on('GET', '/emails/a%2Bb%40test.com', () =>
        json([
          {
            book_id: '34',
            email: 'a+b@test.com',
            status: '1',
            status_explain: 'Active',
            variables: [{ name: 'name', type: 'string', value: 'Ann' }],
          },
        ]),
      );

      expect(await client().findContact('a+b@test.com')).toEqual([
        { bookId: 34, status: 'Active', variables: { name: 'Ann' } },
      ]);
    });

    it('returns no memberships for an unknown email', async () => {
      on('GET', '/emails/x%40test.com', () => json({ error_code: 502, message: 'No such email' }, 400));

      expect(await client().findContact('x@test.com')).toEqual([]);
    });

    it('surfaces other lookup errors', async () => {
      on('GET', '/emails/x%40test.com', () => json({ error_code: 8, message: 'No data' }, 400));

      await expect(client().findContact('x@test.com')).rejects.toThrow('No data');
    });

    it('adds contacts as a JSON array with variables', async () => {
      on('POST', '/addressbooks/7/emails', () => json({ result: true }));

      await client().addContacts(7, [
        { email: 'a@test.com', variables: { name: 'Ann' } },
        { email: 'b@test.com' },
      ]);

      const [, init] = requestsTo('/addressbooks/7/emails')[0];
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body as string)).toEqual({
        emails: [
          { email: 'a@test.com', variables: { name: 'Ann' } },
          { email: 'b@test.com', variables: {} },
        ],
      });
    });

    it('reports non-JSON responses', async () => {
      on('GET', '/addressbooks/1/variables', () => new Response('<html>Bad gateway</html>', { status: 502 }));

      await expect(client().listBookVariables(1)).rejects.toThrow('HTTP 502');
    });

    it('asks SendPulse to send a confirmation email for double opt-in', async () => {
      on('POST', '/addressbooks/7/emails', () => json({ result: true }));

      await client().addContacts(7, [{ email: 'a@test.com' }], { senderEmail: 'me@co.com', lang: 'uk' });

      expect(JSON.parse(requestsTo('/addressbooks/7/emails')[0][1].body)).toEqual({
        emails: [{ email: 'a@test.com', variables: {} }],
        confirmation: 'force',
        sender_email: 'me@co.com',
        message_lang: 'ua',
      });
    });

    it('removes contacts from a book', async () => {
      on('DELETE', '/addressbooks/7/emails', () => json({ result: true }));

      await client().removeContacts(7, ['a@test.com']);
      expect(JSON.parse(requestsTo('/addressbooks/7/emails')[0][1].body)).toEqual({ emails: ['a@test.com'] });
    });

    it('updates variables of an existing contact', async () => {
      on('POST', '/addressbooks/7/emails/variable', () => json({ result: true }));

      await client().updateVariables(7, 'a@test.com', { Company: 'Acme', title: 'CTO' });
      expect(JSON.parse(requestsTo('/addressbooks/7/emails/variable')[0][1].body)).toEqual({
        email: 'a@test.com',
        variables: [
          { name: 'Company', value: 'Acme' },
          { name: 'title', value: 'CTO' },
        ],
      });
    });

    it('lists only active senders', async () => {
      on('GET', '/senders', () =>
        json([
          { name: 'Me', email: 'me@co.com', status: 'Active' },
          { name: 'New', email: 'new@co.com', status: 'Waiting for activation' },
        ]),
      );

      expect(await client().listSenders()).toEqual([{ name: 'Me', email: 'me@co.com' }]);
    });

    it('reads campaign statistics of a contact', async () => {
      on('GET', '/emails/a%40test.com/campaigns', () =>
        json({ statistic: { sent: 12, open: 5, link: 2 }, blacklist: true, addressbooks: [] }),
      );

      expect(await client().contactStats('a@test.com')).toEqual({
        sent: 12,
        opened: 5,
        clicked: 2,
        blacklisted: true,
      });
    });

    it('reports empty statistics for an unknown email', async () => {
      on('GET', '/emails/x%40test.com/campaigns', () =>
        json({ error_code: 502, message: 'No such email' }, 400),
      );

      expect(await client().contactStats('x@test.com')).toEqual({
        sent: 0,
        opened: 0,
        clicked: 0,
        blacklisted: false,
      });
    });

    it('unsubscribes from one book', async () => {
      on('POST', '/addressbooks/7/emails/unsubscribe', () => json({ result: true }));

      await client().unsubscribe(7, ['a@test.com']);
      const [, init] = requestsTo('/addressbooks/7/emails/unsubscribe')[0];
      expect(JSON.parse(init.body as string)).toEqual({ emails: ['a@test.com'] });
    });

    it('sends blacklist changes as Base64', async () => {
      on('POST', '/blacklist', () => json({ result: true }));
      on('DELETE', '/blacklist', () => json({ result: true }));

      await client().setBlacklisted(['a@test.com', 'b@test.com'], true);
      await client().setBlacklisted(['пошта@приклад.укр'], false);

      const [add, remove] = requestsTo('/blacklist');
      expect(add[1].method).toBe('POST');
      expect(atob(JSON.parse(add[1].body).emails)).toBe('a@test.com,b@test.com');
      expect(remove[1].method).toBe('DELETE');
      const bytes = Uint8Array.from(atob(JSON.parse(remove[1].body).emails), (c) => c.charCodeAt(0));
      expect(new TextDecoder().decode(bytes)).toBe('пошта@приклад.укр');
    });

    describe('CRM', () => {
      const found = (list: unknown[]) => json({ success: true, data: { list, total: list.length } });

      it('finds a contact by exact email', async () => {
        on('POST', '/crm/v1/contacts/get-list-by-email', () =>
          found([
            { id: 1, emails: [{ email: 'ann.lee@test.com' }] },
            { id: 2, emails: [{ email: 'Ann@Test.com' }] },
          ]),
        );

        expect(await client().crmFindContact('ann@test.com')).toBe(2);
      });

      it('returns null when the CRM has no such contact', async () => {
        on('POST', '/crm/v1/contacts/get-list-by-email', () => found([]));

        expect(await client().crmFindContact('ann@test.com')).toBeNull();
      });

      it('reuses an existing contact', async () => {
        on('POST', '/crm/v1/contacts/get-list-by-email', () => found([{ id: 9, emails: [] }]));

        expect(
          await client().crmEnsureContact({ email: 'a@test.com', firstName: 'Ann', lastName: '' }),
        ).toEqual({ id: 9, created: false });
        expect(requestsTo('/crm/v1/contacts/create')).toHaveLength(0);
      });

      it('creates a contact with its email and phone', async () => {
        on('POST', '/crm/v1/contacts/get-list-by-email', () => found([]));
        on('POST', '/crm/v1/contacts/create', () => json({ success: true, data: { id: 42 } }));
        on('POST', '/crm/v1/contacts/42/emails', () => json({ success: true, data: {} }));
        on('POST', '/crm/v1/contacts/42/phones', () => json({ success: true, data: {} }));

        expect(
          await client().crmEnsureContact({
            email: 'a@test.com',
            firstName: 'Ann',
            lastName: '',
            phone: '+380501234567',
          }),
        ).toEqual({ id: 42, created: true });

        const body = (path: string) => JSON.parse(requestsTo(path)[0][1].body);
        expect(body('/crm/v1/contacts/create')).toEqual({ firstName: 'Ann', lastName: null });
        expect(body('/crm/v1/contacts/42/emails')).toEqual({
          emails: [{ email: 'a@test.com', isMain: true }],
        });
        expect(body('/crm/v1/contacts/42/phones')).toEqual({ phone: '+380501234567' });
      });

      it('lists pipelines with ordered steps', async () => {
        on('GET', '/crm/v1/pipelines', () =>
          json({
            success: true,
            data: [
              {
                id: 3,
                name: 'Sales',
                steps: [
                  { id: 11, name: 'Won', order: 2 },
                  { id: 10, name: 'New', order: 1 },
                ],
              },
            ],
          }),
        );

        expect(await client().crmPipelines()).toEqual([
          {
            id: 3,
            name: 'Sales',
            steps: [
              { id: 10, name: 'New' },
              { id: 11, name: 'Won' },
            ],
          },
        ]);
      });

      it('adds a comment to a contact', async () => {
        on('POST', '/crm/v1/contacts/5/comments', () => json({ success: true, data: { id: 1 } }));

        await client().crmAddComment(5, 'Hello');
        expect(JSON.parse(requestsTo('/crm/v1/contacts/5/comments')[0][1].body)).toEqual({
          message: 'Hello',
        });
      });

      it('lists task boards from the double-wrapped response', async () => {
        on('GET', '/crm/v1/boards', () =>
          json({
            success: true,
            data: {
              data: [
                {
                  id: 4,
                  name: 'Tasks',
                  steps: [
                    { id: 21, name: 'Done', order: 3 },
                    { id: 20, name: 'To do', order: 1 },
                  ],
                },
              ],
            },
          }),
        );

        expect(await client().crmBoards()).toEqual([
          {
            id: 4,
            name: 'Tasks',
            steps: [
              { id: 20, name: 'To do' },
              { id: 21, name: 'Done' },
            ],
          },
        ]);
      });

      it('creates a task linked to contacts', async () => {
        on('POST', '/crm/v1/tasks', () => json({ success: true, data: { id: 99 } }));

        expect(
          await client().crmCreateTask({
            boardId: 4,
            stepId: 20,
            name: 'Follow up: Ann',
            finishAt: '2026-11-01T10:00:00.000Z',
            contactIds: [5],
          }),
        ).toEqual({ id: 99 });
        expect(JSON.parse(requestsTo('/crm/v1/tasks')[0][1].body)).toEqual({
          boardId: 4,
          stepId: 20,
          priority: 1,
          name: 'Follow up: Ann',
          description: null,
          finishAt: '2026-11-01T10:00:00.000Z',
          connections: { contactIds: [5] },
        });
      });

      it('creates a deal linked to at most five contacts', async () => {
        on('POST', '/crm/v1/contacts/get-list-by-email', (init) =>
          found([{ id: Number(JSON.parse(init.body as string).email[0]), emails: [] }]),
        );
        on('POST', '/crm/v1/deals', () => json({ success: true, data: { id: 77 } }));

        const contacts = [1, 2, 3, 4, 5, 6].map((n) => ({
          email: `${n}@test.com`,
          firstName: '',
          lastName: '',
        }));
        expect(
          await client().crmCreateDeal({ pipelineId: 3, stepId: 10, name: 'Re: offer', contacts }),
        ).toEqual({ id: 77 });

        expect(JSON.parse(requestsTo('/crm/v1/deals')[0][1].body)).toEqual({
          pipelineId: 3,
          stepId: 10,
          name: 'Re: offer',
          contact: [1, 2, 3, 4, 5],
        });
      });
    });
  });

  it('logout forgets credentials and token', async () => {
    const c = client();
    await c.login(CREDS);

    expect(await c.logout()).toEqual({ loggedIn: false });
    expect(await c.status()).toEqual({ loggedIn: false });
    expect(await tokens.get('token')).toBeUndefined();
  });
});

describe('confirmationLang', () => {
  it('maps UI languages to SendPulse confirmation email languages', () => {
    expect(confirmationLang('uk')).toBe('ua');
    expect(confirmationLang('pt-BR')).toBe('pt');
    expect(confirmationLang('es-419')).toBe('es');
    expect(confirmationLang('de')).toBe('en');
  });
});
