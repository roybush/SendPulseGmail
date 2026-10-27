import type { Method, Params, Result, RpcRequest, RpcResponse } from '../shared/messages';
import type { SendPulseClient } from './sendpulse';

type Handlers = { [M in Method]: (params: Params<M>) => Promise<Result<M>> };

export function createRouter(client: SendPulseClient, version: string) {
  const handlers: Handlers = {
    'app.version': async () => version,
    'auth.status': () => client.status(),
    'auth.login': (p) => client.login(p),
    'auth.logout': () => client.logout(),
    'books.list': () => client.listAddressBooks(),
    'books.variables': (p) => client.listBookVariables(p.bookId),
    'contact.find': (p) => client.findContact(p.email),
    'contact.add': (p) => client.addContacts(p.bookId, p.contacts),
  };

  return async function route(request: RpcRequest): Promise<RpcResponse> {
    const handler = handlers[request?.method] as ((p: unknown) => Promise<unknown>) | undefined;
    if (!handler) return { ok: false, error: `Unknown method: ${String(request?.method)}` };
    try {
      return { ok: true, data: await handler(request.params) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}
