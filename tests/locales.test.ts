import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../public/_locales/', import.meta.url);
type Messages = Record<string, { message: string; description?: string }>;
const load = (lang: string): Messages =>
  JSON.parse(readFileSync(new URL(`${lang}/messages.json`, dir), 'utf8'));

const langs = readdirSync(dir);
const en = load('en');
const placeholders = (text: string) => [...new Set(text.match(/\$\d/g) ?? [])].sort();

describe('locales', () => {
  it('ships the languages we promise', () => {
    expect(langs.sort()).toEqual(['de', 'en', 'es', 'fr', 'pl', 'pt_BR', 'tr', 'uk']);
  });

  it.each(langs)('%s has every key, non-empty, with the same $n substitutions', (lang) => {
    const messages = load(lang);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    for (const [key, { message }] of Object.entries(messages)) {
      expect(message.trim(), `${lang}.${key}`).not.toBe('');
      expect(placeholders(message), `${lang}.${key}`).toEqual(placeholders(en[key].message));
    }
  });

  // Chrome Web Store limits: name 75, summary 132 characters.
  it.each(langs)('%s name and description fit the store limits', (lang) => {
    const messages = load(lang);
    expect(messages.extName.message.length).toBeLessThanOrEqual(75);
    expect(messages.extDescription.message.length).toBeLessThanOrEqual(132);
  });

  it('every t() key used in the source exists', () => {
    const files = [
      'src/content/SidebarPanel.vue',
      'src/content/FieldMappingEditor.vue',
      'src/options/App.vue',
    ];
    const used = files.flatMap((f) =>
      [...readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').matchAll(/\bt\('([A-Za-z]+)'/g)].map(
        (m) => m[1],
      ),
    );
    expect(used.length).toBeGreaterThan(20);
    expect(used.filter((key) => !(key in en))).toEqual([]);
  });
});
