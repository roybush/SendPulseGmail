// Renders the real panel / settings components with fictional data for store screenshots.
// The extension APIs are replaced by an in-memory fake of the service worker.
import { createApp } from 'vue';
import SidebarPanel from '../../../src/content/SidebarPanel.vue';
import SettingsApp from '../../../src/options/App.vue';

const params = new URLSearchParams(location.search);
const scene = params.get('scene') ?? 'contacts';
const lang = params.get('lang') ?? 'en';

// chrome.i18n stand-in: the real messages.json for the requested language.
const catalogs = import.meta.glob<Record<string, { message: string }>>(
  '../../../public/_locales/*/messages.json',
  {
    eager: true,
    import: 'default',
  },
);
const messages = catalogs[`../../../public/_locales/${lang}/messages.json`];
const getMessage = (key: string, subs: string[] = []) =>
  (messages[key]?.message ?? '').replace(/\$(\d)/g, (_, n) => subs[Number(n) - 1] ?? '');

const members: Record<string, { bookId: number; status: string; variables: Record<string, string> }[]> = {
  'ann.lee@acme.com': [{ bookId: 1, status: 'Active', variables: { firstName: 'Ann', lastName: 'Lee' } }],
  'olena.koval@agroplus.ua': [
    { bookId: 3, status: 'Active', variables: { firstName: 'Olena', lastName: 'Koval' } },
  ],
};

const responses: Record<string, (params: any) => unknown> = {
  'app.version': () => '2.0.0',
  'auth.status': () =>
    scene === 'connect'
      ? { loggedIn: false }
      : { loggedIn: true, method: 'apiKey', label: 'sp_apikey_…4f2a1' },
  'books.list': () => [
    { id: 1, name: 'Clients', totalEmails: 1240, activeEmails: 1198 },
    { id: 2, name: 'Leads — Q4', totalEmails: 310, activeEmails: 305 },
    { id: 3, name: 'Newsletter', totalEmails: 5820, activeEmails: 5641 },
  ],
  'prefs.get': () => ({ lastBookId: 2 }),
  'prefs.set': (p) => p,
  'books.variables': () => [
    { name: 'firstName', type: 'string' },
    { name: 'lastName', type: 'string' },
    { name: 'Company', type: 'string' },
    { name: 'Position', type: 'string' },
  ],
  'contact.find': (p) => members[p.email] ?? [],
  'contact.add': () => undefined,
  'contact.stats': (p) =>
    members[p.email]
      ? { sent: 14, opened: 9, clicked: 3, blacklisted: false }
      : { sent: 0, opened: 0, clicked: 0, blacklisted: false },
  'auth.accounts': () =>
    scene === 'bulk'
      ? [
          { label: 'sp_apikey_…4f2a1', method: 'apiKey', active: true },
          { label: 'sp_apikey_…9c3d7', method: 'apiKey', active: false },
        ]
      : [{ label: 'sp_apikey_…4f2a1', method: 'apiKey', active: true }],
  'senders.list': () => [{ name: 'Stone Labs', email: 'hello@stonelabs.io' }],
  'crm.findContact': (p) => (p.email === 'ann.lee@acme.com' ? 501 : null),
  'crm.pipelines': () => [
    {
      id: 1,
      name: 'Sales',
      steps: [
        { id: 10, name: 'New lead' },
        { id: 11, name: 'Proposal' },
      ],
    },
  ],
};

(window as any).chrome = {
  i18n: { getMessage, getUILanguage: () => lang.replace('_', '-') },
  runtime: {
    getURL: (path: string) => `/${path}`,
    async sendMessage({ method, params }: { method: string; params: unknown }) {
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true, data: responses[method]?.(params) };
    },
  },
};

if (scene === 'connect') {
  createApp(SettingsApp).mount('#popup');
} else {
  createApp(SidebarPanel, {
    subject: 'Partnership proposal',
    bulk: scene === 'bulk',
    email:
      scene === 'bulk'
        ? undefined
        : { subject: 'Partnership proposal', url: 'https://mail.google.com/mail/u/0/#all/1', text: 'Hi!' },
    participants: [
      {
        email: 'bob@stonelabs.io',
        name: 'Bob Stone',
        firstName: 'Bob',
        lastName: 'Stone',
        isSender: true,
        automated: false,
        details: {
          phone: '+44 20 7946 0321',
          title: 'Founder & CEO',
          company: 'Stone Labs',
          website: 'https://stonelabs.io',
          linkedin: 'https://www.linkedin.com/in/bobstone',
        },
      },
      {
        email: 'maria.garcia@stonelabs.io',
        name: 'Maria Garcia',
        firstName: 'Maria',
        lastName: 'Garcia',
        isSender: false,
        automated: false,
        details: {},
      },
      {
        email: 'ann.lee@acme.com',
        name: 'Ann Lee',
        firstName: 'Ann',
        lastName: 'Lee',
        isSender: false,
        automated: false,
        details: {},
      },
    ],
  }).mount('#app');
}
