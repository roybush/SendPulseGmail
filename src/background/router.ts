import type { Method, Params, Result, RpcRequest, RpcResponse } from '../shared/messages';
import type { Prefs } from '../shared/types';
import type { SendPulseClient } from './sendpulse';
import type { KeyValueStore } from './storage';

const PREFS_KEY = 'prefs';

type Handlers = { [M in Method]: (params: Params<M>) => Promise<Result<M>> };

export type AppInfo = { version: string };

/** Other listeners (e.g. InboxSDK's) share chrome.runtime.onMessage; only answer our own calls. */
export function isRpcRequest(message: unknown): message is RpcRequest {
  return typeof (message as RpcRequest | undefined)?.method === 'string';
}

export function createRouter(client: SendPulseClient, app: AppInfo, prefs: KeyValueStore) {
  const getPrefs = async (): Promise<Prefs> => (await prefs.get<Prefs>(PREFS_KEY)) ?? {};

  const handlers: Handlers = {
    'app.version': async () => app.version,
    'prefs.get': getPrefs,
    'prefs.set': async (p) => {
      const next = { ...(await getPrefs()), ...p };
      await prefs.set(PREFS_KEY, next);
      return next;
    },
    'auth.status': () => client.status(),
    'auth.login': (p) => client.login(p),
    'auth.logout': () => client.logout(),
    'books.list': () => client.listAddressBooks(),
    'books.variables': (p) => client.listBookVariables(p.bookId),
    'contact.find': (p) => client.findContact(p.email),
    'contact.add': (p) => client.addContacts(p.bookId, p.contacts),
  };

  return async function route(request: RpcRequest): Promise<RpcResponse> {
    const handler = handlers[request.method] as ((p: unknown) => Promise<unknown>) | undefined;
    if (!handler) return { ok: false, error: `Unknown method: ${request.method}` };
    try {
      return { ok: true, data: await handler(request.params) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}
