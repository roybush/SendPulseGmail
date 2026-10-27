/**
 * Typed protocol between the content script / options page and the service worker.
 * Every network call to SendPulse goes through the service worker, so tokens never
 * reach the Gmail page.
 */

export type Request = { type: 'ping' };

export type ResponseFor<R extends Request> = R extends { type: 'ping' }
  ? { ok: true; version: string }
  : never;

export async function send<R extends Request>(request: R): Promise<ResponseFor<R>> {
  return chrome.runtime.sendMessage(request);
}
