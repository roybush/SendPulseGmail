import { describe, expect, it, vi } from 'vitest';
import { Enricher } from '../src/background/enrichment';
import { memoryStore } from '../src/background/storage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function enricher(
  provider: 'hunter' | 'apollo',
  respond: (url: string, init: RequestInit) => Response,
) {
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => respond(url, init));
  const e = new Enricher(memoryStore(), fetchFn as unknown as typeof fetch);
  await e.configure(provider, ' FAKE_key_12345 ');
  return { e, fetchFn };
}

describe('Enricher', () => {
  it('reports the provider with a masked key', async () => {
    const { e } = await enricher('hunter', () => json({}));
    expect(await e.status()).toEqual({ provider: 'hunter', label: '…12345' });
    await e.clear();
    expect(await e.status()).toBeNull();
  });

  it('maps a Hunter person', async () => {
    const { e, fetchFn } = await enricher('hunter', () =>
      json({
        data: {
          name: { givenName: 'Ann', familyName: 'Lee' },
          employment: { name: 'Acme', title: 'CTO', domain: 'acme.com' },
          linkedin: { handle: 'annlee' },
          phone: null,
        },
      }),
    );

    expect(await e.enrich('ann@acme.com')).toEqual({
      firstName: 'Ann',
      lastName: 'Lee',
      company: 'Acme',
      title: 'CTO',
      website: 'https://acme.com',
      linkedin: 'https://www.linkedin.com/in/annlee',
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.hunter.io/v2/people/find?email=ann%40acme.com');
    expect(init.headers).toEqual({ 'X-API-KEY': 'FAKE_key_12345' });
  });

  it('respects Hunter not-found and opt-out answers', async () => {
    for (const status of [404, 451]) {
      const { e } = await enricher('hunter', () => json({ errors: [] }, status));
      expect(await e.enrich('x@acme.com')).toBeNull();
    }
  });

  it('maps an Apollo match and ignores "none" confidence', async () => {
    const person = {
      first_name: 'Ann',
      last_name: 'Lee',
      title: 'CTO',
      linkedin_url: 'http://www.linkedin.com/in/annlee',
      organization: { name: 'Acme', website_url: 'http://www.acme.com' },
      contact: { phone_numbers: [{ sanitized_number: '+380501112233' }] },
    };
    const { e, fetchFn } = await enricher('apollo', () => json({ person }));
    expect(await e.enrich('ann@acme.com')).toEqual({
      firstName: 'Ann',
      lastName: 'Lee',
      company: 'Acme',
      title: 'CTO',
      website: 'http://www.acme.com',
      linkedin: 'http://www.linkedin.com/in/annlee',
      phone: '+380501112233',
    });
    expect(fetchFn.mock.calls[0][1].method).toBe('POST');

    const none = await enricher('apollo', () => json({ person: { ...person, match_confidence: 'none' } }));
    expect(await none.e.enrich('ann@acme.com')).toBeNull();
  });

  it('explains a rejected key', async () => {
    const { e } = await enricher('apollo', () => new Response('Invalid API key.', { status: 401 }));
    await expect(e.enrich('ann@acme.com')).rejects.toThrow('Apollo: invalid API key');
  });
});
