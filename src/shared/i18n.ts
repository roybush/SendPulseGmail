/**
 * UI strings via chrome.i18n. Translations live in public/_locales/<lang>/messages.json
 * (generated from scripts/locales.py); Chrome picks the language from the browser's UI locale.
 */
export type MessageKey = keyof typeof import('../../public/_locales/en/messages.json');

export function t(key: MessageKey, ...substitutions: (string | number)[]): string {
  // getMessage returns "" for an unknown key; show the key so a missing string is easy to spot.
  return chrome.i18n.getMessage(key, substitutions.map(String)) || key;
}

/** BCP 47 tag of the UI language, for <html lang>. */
export function uiLanguage(): string {
  return chrome.i18n.getUILanguage();
}
