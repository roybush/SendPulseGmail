/**
 * InboxSDK is written for Chrome, where a content script and the page share plain JS objects.
 * Firefox isolates them (Xray vision), which breaks two things InboxSDK relies on. Call this
 * before InboxSDK.load(); it does nothing outside Firefox.
 */

declare global {
  /** Firefox-only: copies `obj` into the compartment of `target` so page scripts can read it. */
  function cloneInto<T>(obj: T, target: object, options?: { wrapReflectors?: boolean }): T;
}

export function patchInboxSdkForFirefox(): void {
  if (typeof cloneInto !== 'function') return;

  // InboxSDK asks the background to inject pageWorld.js via `window.chrome.runtime`, but in
  // Firefox `chrome` is a sandbox global, not a property of `window`. This expando lives only in
  // the content script; Gmail's own scripts don't see it.
  (window as { chrome?: typeof chrome }).chrome ??= chrome;

  // InboxSDK talks to its page-world script through CustomEvent `detail` objects. Gmail can't read
  // objects created by a content script ("Permission denied to access property"), so clone each
  // detail into the page first. InboxSDK looks up the global `CustomEvent` at call time.
  const ContentCustomEvent = CustomEvent;
  function PageCustomEvent(type: string, init?: CustomEventInit) {
    if (init?.detail == null) return new ContentCustomEvent(type, init);
    const detail = cloneInto(init.detail, window, { wrapReflectors: true });
    return new ContentCustomEvent(type, { ...init, detail });
  }
  PageCustomEvent.prototype = ContentCustomEvent.prototype; // keeps `instanceof CustomEvent` working
  globalThis.CustomEvent = PageCustomEvent as unknown as typeof CustomEvent;
}
