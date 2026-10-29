<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { call } from '../shared/messages';
import { PROVIDER_ORIGINS } from '../background/enrichment';
import type {
  Account,
  AddressBook,
  AuthStatus,
  Credentials,
  EnrichmentProvider,
  EnrichmentStatus,
} from '../shared/types';
import SpSelect from '../shared/ui/SpSelect.vue';
import { t, uiLanguage } from '../shared/i18n';
import SpTextField from '../shared/ui/SpTextField.vue';
import '../shared/ui/buttons.css';

/**
 * One settings UI for three places: the options tab, the toolbar popup and an iframe
 * inside the Gmail sidebar panel (the iframe keeps secrets out of Gmail's DOM).
 */
const embedded = window.top !== window;
if (embedded) document.documentElement.classList.add('embedded');
document.documentElement.lang = uiLanguage();
document.title = t('extName');
const GMAIL_ORIGIN = 'https://mail.google.com';

const version = ref('');
const status = ref<AuthStatus | null>(null);
const method = ref<Credentials['kind']>('apiKey');
const apiKey = ref('');
const clientId = ref('');
const clientSecret = ref('');
const books = ref<AddressBook[]>([]);
const accounts = ref<Account[]>([]);
// Optional enrichment provider (Hunter / Apollo) with the user's own key.
const enrichment = ref<EnrichmentStatus>(null);
const provider = ref<EnrichmentProvider>('hunter');
const providerKey = ref('');
const PROVIDERS: { value: EnrichmentProvider; label: string }[] = [
  { value: 'hunter', label: 'Hunter' },
  { value: 'apollo', label: 'Apollo' },
];
const providerName = (p: EnrichmentProvider) => PROVIDERS.find((x) => x.value === p)?.label ?? p;

function saveEnrichment() {
  // Permission prompts need the click's user gesture, so ask before any await.
  const asked = chrome.permissions.request({ origins: [PROVIDER_ORIGINS[provider.value]] });
  run(async () => {
    if (!(await asked)) throw new Error(t('permissionDenied'));
    enrichment.value = await call('enrich.configure', {
      provider: provider.value,
      apiKey: providerKey.value,
    });
    providerKey.value = '';
  });
}

const removeEnrichment = () =>
  run(async () => {
    const current = enrichment.value;
    await call('enrich.clear');
    enrichment.value = null;
    if (current) await chrome.permissions.remove({ origins: [PROVIDER_ORIGINS[current.provider]] });
  });

/** Showing the connect form while already connected, to add another account. */
const adding = ref(false);
const busy = ref(false);
const error = ref('');
const root = ref<HTMLElement>();

function notifyParent(message: { type: string; height?: number }) {
  if (embedded) window.parent.postMessage(message, GMAIL_ORIGIN);
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  try {
    await action();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function loadBooks() {
  books.value = status.value?.loggedIn ? await call('books.list') : [];
}

async function refresh() {
  accounts.value = await call('auth.accounts');
  enrichment.value = await call('enrich.status');
  if (!embedded) await loadBooks();
}

const switchTo = (label: string) =>
  run(async () => {
    status.value = await call('auth.switch', { label });
    notifyParent({ type: 'sendpulse:connected' });
    await refresh();
  });

const connect = () =>
  run(async () => {
    const credentials: Credentials =
      method.value === 'apiKey'
        ? { kind: 'apiKey', apiKey: apiKey.value }
        : { kind: 'oauth', clientId: clientId.value, clientSecret: clientSecret.value };
    status.value = await call('auth.login', credentials);
    apiKey.value = clientSecret.value = '';
    adding.value = false;
    notifyParent({ type: 'sendpulse:connected' });
    await refresh();
  });

const disconnect = () =>
  run(async () => {
    status.value = await call('auth.logout');
    notifyParent({ type: status.value.loggedIn ? 'sendpulse:connected' : 'sendpulse:disconnected' });
    await refresh();
  });

// Let the Gmail panel size the iframe to its content.
const resizeObserver = new ResizeObserver(([entry]) =>
  notifyParent({ type: 'sendpulse:height', height: Math.ceil(entry.borderBoxSize[0].blockSize) }),
);

onMounted(() => {
  if (embedded && root.value) resizeObserver.observe(root.value);
  run(async () => {
    version.value = await call('app.version');
    status.value = await call('auth.status');
    await refresh();
  });
});
onUnmounted(() => resizeObserver.disconnect());
</script>

<template>
  <main ref="root" :class="{ embedded }">
    <header v-if="!embedded">
      <img src="/icons/icon-128.png" alt="" width="28" height="28" />
      <h1>{{ t('extName') }}</h1>
    </header>

    <p v-if="!status" class="muted">{{ t('loading') }}</p>

    <section v-else-if="status.loggedIn && !adding" class="card">
      <div class="row">
        <div>
          <div class="ok">● {{ t('connected') }}</div>
          <div class="muted">
            {{ status.method === 'apiKey' ? t('apiKey') : t('clientId') }} <code>{{ status.label }}</code>
          </div>
        </div>
        <button
          type="button"
          class="sp-btn sp-btn--outlined sp-btn--small"
          :disabled="busy"
          @click="disconnect"
        >
          {{ t('disconnect') }}
        </button>
      </div>

      <ul v-if="accounts.length > 1" class="accounts">
        <li v-for="a in accounts.filter((x) => !x.active)" :key="a.label">
          <code>{{ a.label }}</code>
          <button
            type="button"
            class="sp-btn sp-btn--text sp-btn--small"
            :disabled="busy"
            @click="switchTo(a.label)"
          >
            {{ t('switchAccount') }}
          </button>
        </li>
      </ul>
      <button type="button" class="sp-btn sp-btn--text sp-btn--small add-account" @click="adding = true">
        + {{ t('addAccount') }}
      </button>

      <h2>{{ t('enrichment') }}</h2>
      <div v-if="enrichment" class="row">
        <div class="muted">
          {{ providerName(enrichment.provider) }} <code>{{ enrichment.label }}</code>
        </div>
        <button
          type="button"
          class="sp-btn sp-btn--outlined sp-btn--small"
          :disabled="busy"
          @click="removeEnrichment"
        >
          {{ t('remove') }}
        </button>
      </div>
      <form v-else class="enrich" @submit.prevent="saveEnrichment">
        <p class="muted hint">{{ t('enrichmentHint') }}</p>
        <SpSelect v-model="provider" :label="t('provider')" :options="PROVIDERS" />
        <SpTextField v-model="providerKey" :label="t('providerKey')" type="password" required />
        <button type="submit" class="sp-btn sp-btn--outlined sp-btn--small" :disabled="busy">
          {{ t('save') }}
        </button>
      </form>

      <template v-if="!embedded">
        <h2>{{ t('mailingLists') }}</h2>
        <p v-if="!books.length" class="muted">{{ t('noListsSettings') }}</p>
        <ul v-else class="books">
          <li v-for="book in books" :key="book.id">
            <span>{{ book.name }}</span>
            <span class="muted">{{ t('activeCount', book.activeEmails) }}</span>
          </li>
        </ul>
        <a
          class="sp-btn sp-btn--filled sp-btn--block"
          href="https://mail.google.com/"
          target="_blank"
          rel="noopener"
        >
          {{ t('openGmail') }}
        </a>
      </template>
    </section>

    <form v-else class="card" @submit.prevent="connect">
      <h2>{{ t('connectTitle') }}</h2>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="method === 'apiKey'"
          :class="{ active: method === 'apiKey' }"
          @click="method = 'apiKey'"
        >
          {{ t('apiKey') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="method === 'oauth'"
          :class="{ active: method === 'oauth' }"
          @click="method = 'oauth'"
        >
          {{ t('clientIdAndSecret') }}
        </button>
      </div>

      <template v-if="method === 'apiKey'">
        <SpTextField v-model="apiKey" :label="t('apiKeyLabel')" type="password" required />
        <p class="muted hint">{{ t('apiKeyHint') }}</p>
      </template>

      <template v-else>
        <SpTextField v-model="clientId" :label="t('clientIdLabel')" required />
        <SpTextField v-model="clientSecret" :label="t('clientSecretLabel')" type="password" required />
        <p class="muted hint">{{ t('oauthHint') }}</p>
      </template>

      <button type="submit" class="sp-btn sp-btn--filled sp-btn--block" :disabled="busy">
        {{ busy ? t('connecting') : t('connect') }}
      </button>
      <button
        v-if="adding"
        type="button"
        class="sp-btn sp-btn--text sp-btn--small"
        :disabled="busy"
        @click="adding = false"
      >
        {{ t('cancel') }}
      </button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <footer v-if="!embedded && version" class="muted">v{{ version }}</footer>
  </main>
</template>

<style>
:root {
  --text: #1f1f1f;
  --muted: #5f6368;
  --border: #dadce0;
  --surface: #fff;
  --page: #f6f8fc;
  --accent: #0b57d0;
  --ok: #146c2e;
  --error: #c5221f;
  color-scheme: light;
}
body {
  margin: 0;
  background: var(--page);
  color: var(--text);
  font:
    14px/1.45 'Google Sans',
    Roboto,
    system-ui,
    sans-serif;
}
/* Inside the Gmail panel: blend into the panel instead of looking like a separate page. */
html.embedded body {
  background: transparent;
}
</style>

<style scoped>
main {
  box-sizing: border-box;
  width: 100%;
  max-width: 440px;
  min-width: 320px;
  margin: 0 auto;
  padding: 24px 16px;
}
main.embedded {
  min-width: 0;
  max-width: none;
  padding: 0;
}
main.embedded .card {
  border: 0;
  padding: 0;
}
header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}
h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}
h2 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 500;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card .row:last-child {
  margin-bottom: 0;
}
.tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 14px;
  background: var(--page);
  border-radius: 8px;
}
.tabs button {
  flex: 1;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.tabs button.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
}
.hint {
  margin: 0;
}
form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
form h2,
form .tabs {
  margin-bottom: 0;
}
.enrich {
  margin-top: 8px;
}
.enrich .sp-btn {
  align-self: flex-start;
}
.accounts {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
.accounts li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  border-top: 1px solid var(--border);
}
.add-account {
  margin: 8px 0 0 -12px;
}
.books {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}
.books li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}
.muted {
  color: var(--muted);
  font-size: 12px;
}
.ok {
  color: var(--ok);
  font-weight: 500;
}
.error {
  color: var(--error);
  margin: 12px 0 0;
}
code {
  font-size: 12px;
}
footer {
  margin-top: 12px;
  text-align: center;
}
</style>
