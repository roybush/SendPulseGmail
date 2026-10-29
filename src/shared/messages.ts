/**
 * Typed RPC between the content script / options page and the service worker.
 * Every network call to SendPulse goes through the service worker, so tokens never
 * reach the Gmail page.
 */
import type {
  AddressBook,
  AuthStatus,
  BookVariable,
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
  Prefs,
  Sender,
} from './types';

export type Api = {
  'app.version': { params: void; result: string };
  'prefs.get': { params: void; result: Prefs };
  'prefs.set': { params: Prefs; result: Prefs };
  'auth.status': { params: void; result: AuthStatus };
  'auth.login': { params: Credentials; result: AuthStatus };
  'auth.logout': { params: void; result: AuthStatus };
  'books.list': { params: void; result: AddressBook[] };
  'books.variables': { params: { bookId: number }; result: BookVariable[] };
  'contact.find': { params: { email: string }; result: Membership[] };
  'contact.add': { params: { bookId: number; contacts: NewContact[]; optIn?: OptIn }; result: void };
  'contact.remove': { params: { bookId: number; emails: string[] }; result: void };
  'contact.update': {
    params: { bookId: number; email: string; variables: Record<string, string> };
    result: void;
  };
  'senders.list': { params: void; result: Sender[] };
  'contact.stats': { params: { email: string }; result: ContactStats };
  'contact.unsubscribe': { params: { bookId: number; email: string }; result: void };
  'contact.blacklist': { params: { email: string; blacklisted: boolean }; result: void };
  'crm.findContact': { params: { email: string }; result: number | null };
  'crm.addContact': { params: CrmContactInput; result: { id: number; created: boolean } };
  'crm.pipelines': { params: void; result: CrmPipeline[] };
  'crm.createDeal': { params: NewDeal; result: { id: number } };
  'crm.addComment': { params: { contactId: number; message: string }; result: void };
  'crm.boards': { params: void; result: CrmBoard[] };
  'crm.createTask': { params: NewTask; result: { id: number } };
};

export type Method = keyof Api;
export type Params<M extends Method> = Api[M]['params'];
export type Result<M extends Method> = Api[M]['result'];

export type RpcRequest<M extends Method = Method> = { method: M; params: Params<M> };
export type RpcResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

type ParamsArg<M extends Method> = Params<M> extends void ? [] : [Params<M>];

export async function call<M extends Method>(method: M, ...params: ParamsArg<M>): Promise<Result<M>> {
  const request: RpcRequest<M> = { method, params: params[0] as Params<M> };
  const response: RpcResponse<Result<M>> | undefined = await chrome.runtime.sendMessage(request);
  if (!response) throw new Error('No response from the extension background');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
