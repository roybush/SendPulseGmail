import { describe, expect, it } from 'vitest';
import { createRouter, isRpcRequest } from '../src/background/router';
import type { SendPulseClient } from '../src/background/sendpulse';
import { memoryStore } from '../src/background/storage';
import type { RpcRequest } from '../src/shared/messages';

let account: string | undefined;
const client = {
  status: async () => ({ loggedIn: false }),
  activeAccount: async () => account,
  listAddressBooks: async () => {
    throw new Error('Not logged in to SendPulse');
  },
} as unknown as SendPulseClient;

const route = createRouter(client, { version: '2.0.0' }, memoryStore());

describe('router', () => {
  it('wraps results', async () => {
    expect(await route({ method: 'app.version', params: undefined })).toEqual({ ok: true, data: '2.0.0' });
    expect(await route({ method: 'auth.status', params: undefined })).toEqual({
      ok: true,
      data: { loggedIn: false },
    });
  });

  it('turns thrown errors into error responses', async () => {
    expect(await route({ method: 'books.list', params: undefined })).toEqual({
      ok: false,
      error: 'Not logged in to SendPulse',
    });
  });

  it('merges and keeps prefs', async () => {
    expect(await route({ method: 'prefs.get', params: undefined })).toEqual({ ok: true, data: {} });
    await route({ method: 'prefs.set', params: { lastBookId: 7 } });
    expect(await route({ method: 'prefs.get', params: undefined })).toEqual({
      ok: true,
      data: { lastBookId: 7 },
    });
  });

  it('keeps prefs per account, seeded from the shared ones', async () => {
    const store = memoryStore();
    const r = createRouter(client, { version: '2.0.0' }, store);
    await store.set('prefs', { lastBookId: 1 });

    account = 'sp_apikey_…aaaaa';
    expect(await r({ method: 'prefs.get', params: undefined })).toEqual({
      ok: true,
      data: { lastBookId: 1 },
    });
    await r({ method: 'prefs.set', params: { lastBookId: 2 } });
    account = 'sp_apikey_…bbbbb';
    await r({ method: 'prefs.set', params: { lastBookId: 3 } });

    account = 'sp_apikey_…aaaaa';
    expect(await r({ method: 'prefs.get', params: undefined })).toEqual({
      ok: true,
      data: { lastBookId: 2 },
    });
    account = undefined;
  });

  it('ignores messages that are not ours', () => {
    expect(isRpcRequest({ type: 'inboxsdk__injectPageWorld' })).toBe(false);
    expect(isRpcRequest(undefined)).toBe(false);
    expect(isRpcRequest({ method: 'auth.status' })).toBe(true);
  });

  it('rejects unknown methods', async () => {
    expect(await route({ method: 'nope', params: undefined } as unknown as RpcRequest)).toEqual({
      ok: false,
      error: 'Unknown method: nope',
    });
  });
});
