/**
 * Optional contact enrichment through a provider the user has a key for (Hunter or Apollo).
 * Runs only when the user clicks the button for a person; the key never leaves the service worker.
 * Hunter: https://hunter.io/api-documentation/v2#email-enrichment
 * Apollo: https://docs.apollo.io/reference/people-enrichment
 */
import type { EnrichedProfile, EnrichmentProvider, EnrichmentStatus } from '../shared/types';
import { mask } from './sendpulse';
import type { KeyValueStore } from './storage';

/** Host each provider needs; requested at runtime as an optional permission. */
export const PROVIDER_ORIGINS: Record<EnrichmentProvider, string> = {
  hunter: 'https://api.hunter.io/*',
  apollo: 'https://api.apollo.io/*',
};

const SETTINGS_KEY = 'enrichment';

type Settings = { provider: EnrichmentProvider; apiKey: string };

export class Enricher {
  constructor(
    private readonly store: KeyValueStore,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async status(): Promise<EnrichmentStatus> {
    const s = await this.store.get<Settings>(SETTINGS_KEY);
    return s ? { provider: s.provider, label: mask(s.apiKey) } : null;
  }

  async configure(provider: EnrichmentProvider, apiKey: string): Promise<EnrichmentStatus> {
    const key = apiKey.trim();
    if (!key) throw new Error('API key is required');
    await this.store.set(SETTINGS_KEY, { provider, apiKey: key });
    return this.status();
  }

  async clear(): Promise<void> {
    await this.store.remove(SETTINGS_KEY);
  }

  /** What the provider knows about this address, or null if nothing. */
  async enrich(email: string): Promise<EnrichedProfile | null> {
    const s = await this.store.get<Settings>(SETTINGS_KEY);
    if (!s) throw new Error('No enrichment provider is set up');
    return s.provider === 'hunter' ? this.hunter(s.apiKey, email) : this.apollo(s.apiKey, email);
  }

  private async hunter(apiKey: string, email: string): Promise<EnrichedProfile | null> {
    const res = await this.fetchFn(
      `https://api.hunter.io/v2/people/find?email=${encodeURIComponent(email)}`,
      {
        headers: { 'X-API-KEY': apiKey },
      },
    );
    // 404: unknown; 451: the person asked Hunter not to process their data.
    if (res.status === 404 || res.status === 451) return null;
    const body = await readJson<HunterPerson>(res, 'Hunter');
    const p = body.data;
    if (!p) return null;
    return compact({
      firstName: p.name?.givenName,
      lastName: p.name?.familyName,
      company: p.employment?.name,
      title: p.employment?.title,
      website: p.employment?.domain ? `https://${p.employment.domain}` : undefined,
      linkedin: p.linkedin?.handle ? `https://www.linkedin.com/in/${p.linkedin.handle}` : undefined,
      phone: p.phone ?? undefined,
    });
  }

  private async apollo(apiKey: string, email: string): Promise<EnrichedProfile | null> {
    const res = await this.fetchFn(
      `https://api.apollo.io/api/v1/people/match?email=${encodeURIComponent(email)}`,
      {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      },
    );
    const body = await readJson<ApolloMatch>(res, 'Apollo');
    const p = body.person;
    if (!p || p.match_confidence === 'none') return null;
    return compact({
      firstName: p.first_name,
      lastName: p.last_name,
      company: p.organization?.name,
      title: p.title,
      website: p.organization?.website_url,
      linkedin: p.linkedin_url,
      phone: p.contact?.phone_numbers?.[0]?.sanitized_number,
    });
  }
}

type HunterPerson = {
  data?: {
    name?: { givenName?: string; familyName?: string };
    employment?: { name?: string; title?: string; domain?: string };
    linkedin?: { handle?: string };
    phone?: string | null;
  };
};

type ApolloMatch = {
  person?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    linkedin_url?: string;
    match_confidence?: string;
    organization?: { name?: string; website_url?: string };
    contact?: { phone_numbers?: { sanitized_number?: string }[] };
  } | null;
};

async function readJson<T>(res: Response, provider: string): Promise<T> {
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new Error(`${provider}: invalid API key`);
  if (res.status === 429) throw new Error(`${provider}: rate limit reached, try again later`);
  if (!res.ok) throw new Error(`${provider} request failed (HTTP ${res.status})`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected response from ${provider}`);
  }
}

function compact(p: EnrichedProfile): EnrichedProfile | null {
  const entries = Object.entries(p).filter(([, v]) => typeof v === 'string' && v.trim());
  return entries.length ? (Object.fromEntries(entries) as EnrichedProfile) : null;
}
