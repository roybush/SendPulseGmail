<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { call } from '../shared/messages';
import type { AddressBook, AuthStatus } from '../shared/types';

const version = ref('');
const status = ref<AuthStatus>({ loggedIn: false });
const clientId = ref('');
const clientSecret = ref('');
const books = ref<AddressBook[]>([]);
const busy = ref(false);
const error = ref('');

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
  books.value = status.value.loggedIn ? await call('books.list') : [];
}

const login = () =>
  run(async () => {
    status.value = await call('auth.login', { clientId: clientId.value, clientSecret: clientSecret.value });
    clientSecret.value = '';
    await loadBooks();
  });

const logout = () =>
  run(async () => {
    status.value = await call('auth.logout');
    books.value = [];
  });

onMounted(() =>
  run(async () => {
    version.value = await call('app.version');
    status.value = await call('auth.status');
    await loadBooks();
  }),
);
</script>

<template>
  <main>
    <h1>SendPulse for Gmail</h1>

    <section v-if="status.loggedIn">
      <p>
        Connected as <code>{{ status.clientIdPrefix }}…</code>
        <button type="button" :disabled="busy" @click="logout">Log out</button>
      </p>
      <h2>Address books</h2>
      <ul>
        <li v-for="book in books" :key="book.id">
          {{ book.name }} <span class="muted">({{ book.activeEmails }} active)</span>
        </li>
      </ul>
    </section>

    <form v-else @submit.prevent="login">
      <p class="muted">Find your API credentials in SendPulse → Settings → API.</p>
      <label>
        Client ID
        <input v-model="clientId" autocomplete="off" required />
      </label>
      <label>
        Client Secret
        <input v-model="clientSecret" type="password" autocomplete="off" required />
      </label>
      <button type="submit" :disabled="busy">Connect</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <footer class="muted">v{{ version }}</footer>
  </main>
</template>

<style scoped>
main {
  max-width: 480px;
  margin: 32px auto;
  font-family: system-ui, sans-serif;
}
label {
  display: block;
  margin-bottom: 12px;
}
input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 6px;
}
.muted {
  color: #666;
}
.error {
  color: #c00;
}
</style>
