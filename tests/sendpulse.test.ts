import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, SendPulseClient, SendPulseError } from '../src/background/sendpulse';
import { memoryStore, type KeyValueStore } from '../src/background/storage';

const CREDS = { clientId: 'test_client_id_00000000000000000', clientSecret: 'test_secret' };
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

      expect(status).toEqual({ loggedIn: true, clientIdPrefix: 'test_cli' });
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
      await expect(client().login({ clientId: ' ', clientSecret: '' })).rejects.toBeInstanceOf(
        SendPulseError,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });
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
  });

  it('logout forgets credentials and token', async () => {
    const c = client();
    await c.login(CREDS);

    expect(await c.logout()).toEqual({ loggedIn: false });
    expect(await c.status()).toEqual({ loggedIn: false });
    expect(await tokens.get('token')).toBeUndefined();
  });
});
