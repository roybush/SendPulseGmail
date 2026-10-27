<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { call } from '../shared/messages';
import type { AddressBook, AuthStatus, Credentials } from '../shared/types';
import SpTextField from '../shared/ui/SpTextField.vue';
import '../shared/ui/buttons.css';

/**
 * One settings UI for three places: the options tab, the toolbar popup and an iframe
 * inside the Gmail sidebar panel (the iframe keeps secrets out of Gmail's DOM).
 */
const embedded = window.top !== window;
if (embedded) document.documentElement.classList.add('embedded');
const GMAIL_ORIGIN = 'https://mail.google.com';

const version = ref('');
const status = ref<AuthStatus | null>(null);
const method = ref<Credentials['kind']>('apiKey');
const apiKey = ref('');
const clientId = ref('');
const clientSecret = ref('');
const books = ref<AddressBook[]>([]);
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

const connect = () =>
  run(async () => {
    const credentials: Credentials =
      method.value === 'apiKey'
        ? { kind: 'apiKey', apiKey: apiKey.value }
        : { kind: 'oauth', clientId: clientId.value, clientSecret: clientSecret.value };
    status.value = await call('auth.login', credentials);
    apiKey.value = clientSecret.value = '';
    notifyParent({ type: 'sendpulse:connected' });
    if (!embedded) await loadBooks();
  });

const disconnect = () =>
  run(async () => {
    status.value = await call('auth.logout');
    books.value = [];
    notifyParent({ type: 'sendpulse:disconnected' });
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
    if (!embedded) await loadBooks();
  });
});
onUnmounted(() => resizeObserver.disconnect());
</script>

<template>
  <main ref="root" :class="{ embedded }">
    <header v-if="!embedded">
      <img src="/icons/icon-128.png" alt="" width="28" height="28" />
      <h1>SendPulse Gmail Extension</h1>
    </header>

    <p v-if="!status" class="muted">Loading…</p>

    <section v-else-if="status.loggedIn" class="card">
      <div class="row">
        <div>
          <div class="ok">● Connected</div>
          <div class="muted">
            {{ status.method === 'apiKey' ? 'API key' : 'Client ID' }} <code>{{ status.label }}</code>
          </div>
        </div>
        <button
          type="button"
          class="sp-btn sp-btn--outlined sp-btn--small"
          :disabled="busy"
          @click="disconnect"
        >
          Disconnect
        </button>
      </div>

      <template v-if="!embedded">
        <h2>Address books</h2>
        <p v-if="!books.length" class="muted">No address books yet. Create one in SendPulse.</p>
        <ul v-else class="books">
          <li v-for="book in books" :key="book.id">
            <span>{{ book.name }}</span>
            <span class="muted">{{ book.activeEmails }} active</span>
          </li>
        </ul>
        <a
          class="sp-btn sp-btn--filled sp-btn--block"
          href="https://mail.google.com/"
          target="_blank"
          rel="noopener"
        >
          Open Gmail
        </a>
      </template>
    </section>

    <form v-else class="card" @submit.prevent="connect">
      <h2>Connect SendPulse</h2>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="method === 'apiKey'"
          :class="{ active: method === 'apiKey' }"
          @click="method = 'apiKey'"
        >
          API key
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="method === 'oauth'"
          :class="{ active: method === 'oauth' }"
          @click="method = 'oauth'"
        >
          Client ID &amp; Secret
        </button>
      </div>

      <template v-if="method === 'apiKey'">
        <SpTextField v-model="apiKey" label="API key (sp_apikey_…)" type="password" required />
        <p class="muted hint">SendPulse → Settings → API → <b>API keys</b> (Ключі API) → Create key.</p>
      </template>

      <template v-else>
        <SpTextField v-model="clientId" label="Client ID (sp_id_…)" required />
        <SpTextField v-model="clientSecret" label="Client Secret" type="password" required />
        <p class="muted hint">SendPulse → Settings → API → <b>Credentials</b> (Облікові дані).</p>
      </template>

      <button type="submit" class="sp-btn sp-btn--filled sp-btn--block" :disabled="busy">
        {{ busy ? 'Connecting…' : 'Connect' }}
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
