import { describe, expect, it } from 'vitest';
import { createRouter } from '../src/background/router';
import type { SendPulseClient } from '../src/background/sendpulse';
import type { RpcRequest } from '../src/shared/messages';

const client = {
  status: async () => ({ loggedIn: false }),
  listAddressBooks: async () => {
    throw new Error('Not logged in to SendPulse');
  },
} as unknown as SendPulseClient;

const route = createRouter(client, '2.0.0');

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

  it('rejects unknown methods', async () => {
    expect(await route({ method: 'nope', params: undefined } as unknown as RpcRequest)).toEqual({
      ok: false,
      error: 'Unknown method: nope',
    });
  });
});
