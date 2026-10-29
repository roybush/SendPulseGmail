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
  // Lists, pipelines and field setups belong to one SendPulse account, so prefs are kept per account.
  // Prefs saved before multi-account support (under the bare key) seed every account's prefs.
  const prefsKey = async () => {
    const account = await client.activeAccount();
    return account ? `${PREFS_KEY}:${account}` : PREFS_KEY;
  };
  const getPrefs = async (): Promise<Prefs> =>
    (await prefs.get<Prefs>(await prefsKey())) ?? (await prefs.get<Prefs>(PREFS_KEY)) ?? {};

  const handlers: Handlers = {
    'app.version': async () => app.version,
    'prefs.get': getPrefs,
    'prefs.set': async (p) => {
      const next = { ...(await getPrefs()), ...p };
      await prefs.set(await prefsKey(), next);
      return next;
    },
    'auth.status': () => client.status(),
    'auth.login': (p) => client.login(p),
    'auth.logout': () => client.logout(),
    'auth.accounts': () => client.accounts(),
    'auth.switch': (p) => client.switchAccount(p.label),
    'books.list': () => client.listAddressBooks(),
    'books.variables': (p) => client.listBookVariables(p.bookId),
    'contact.find': (p) => client.findContact(p.email),
    'contact.add': (p) => client.addContacts(p.bookId, p.contacts, p.optIn),
    'contact.remove': (p) => client.removeContacts(p.bookId, p.emails),
    'contact.update': (p) => client.updateVariables(p.bookId, p.email, p.variables),
    'contact.chatbots': (p) => client.chatbotSubscriptions(p.email),
    'automation.event': (p) => client.sendEvent(p.event, p.variables),
    'senders.list': () => client.listSenders(),
    'contact.stats': (p) => client.contactStats(p.email),
    'contact.unsubscribe': (p) => client.unsubscribe(p.bookId, [p.email]),
    'contact.blacklist': (p) => client.setBlacklisted([p.email], p.blacklisted),
    'crm.findContact': (p) => client.crmFindContact(p.email),
    'crm.addContact': (p) => client.crmEnsureContact(p),
    'crm.pipelines': () => client.crmPipelines(),
    'crm.createDeal': (p) => client.crmCreateDeal(p),
    'crm.addComment': (p) => client.crmAddComment(p.contactId, p.message),
    'crm.boards': () => client.crmBoards(),
    'crm.createTask': (p) => client.crmCreateTask(p),
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
