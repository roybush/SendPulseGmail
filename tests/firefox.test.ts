// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { patchInboxSdkForFirefox } from '../src/content/firefox';

const NativeCustomEvent = globalThis.CustomEvent;

afterEach(() => {
  globalThis.CustomEvent = NativeCustomEvent;
  vi.unstubAllGlobals();
});

describe('patchInboxSdkForFirefox', () => {
  it('does nothing outside Firefox', () => {
    patchInboxSdkForFirefox();
    expect(globalThis.CustomEvent).toBe(NativeCustomEvent);
  });

  describe('in Firefox', () => {
    const cloneInto = vi.fn(<T>(obj: T) => structuredClone(obj));
    const extensionApi = { runtime: { id: 'test' } };

    function patch() {
      vi.stubGlobal('cloneInto', cloneInto);
      vi.stubGlobal('chrome', extensionApi);
      patchInboxSdkForFirefox();
    }

    it('exposes the extension API as window.chrome', () => {
      patch();
      expect((window as { chrome?: unknown }).chrome).toBe(extensionApi);
    });

    it('clones event details into the page', () => {
      patch();
      const detail = { threadId: 't1' };
      const event = new CustomEvent('inboxSDKtellMeThisMessageDate', { bubbles: true, detail });
      expect(cloneInto).toHaveBeenCalledWith(detail, window, { wrapReflectors: true });
      expect(event.detail).toEqual(detail);
      expect(event.detail).not.toBe(detail);
      expect(event.bubbles).toBe(true);
      expect(event.type).toBe('inboxSDKtellMeThisMessageDate');
    });

    it('leaves events without a detail alone and keeps instanceof working', () => {
      patch();
      cloneInto.mockClear();
      const event = new CustomEvent('buttonAdded', { detail: null });
      expect(cloneInto).not.toHaveBeenCalled();
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event).toBeInstanceOf(NativeCustomEvent);
    });
  });
});
