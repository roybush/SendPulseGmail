<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { call } from '../shared/messages';
import { detectNameFields, fromVariables, toVariables, type NameFields } from '../shared/fields';
import type { AddressBook, Membership } from '../shared/types';
import type { Participant } from './participants';

const props = defineProps<{ participants: Participant[] }>();

type Row = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  selected: boolean;
  /** null while loading */
  memberships: Membership[] | null;
  lookupError: string;
};

const loggedIn = ref<boolean | null>(null);
const books = ref<AddressBook[]>([]);
const bookId = ref<number | null>(null);
const nameFields = ref<NameFields>({});
const rows = reactive<Row[]>(
  props.participants.map((p) => ({
    email: p.email,
    displayName: p.name,
    firstName: p.firstName,
    lastName: p.lastName,
    selected: false,
    memberships: null,
    lookupError: '',
  })),
);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const book = computed(() => books.value.find((b) => b.id === bookId.value));
const selectedRows = computed(() => rows.filter((r) => r.selected));
const bookNames = computed(() => new Map(books.value.map((b) => [b.id, b.name])));

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

async function lookup(row: Row) {
  row.memberships = null;
  row.lookupError = '';
  try {
    row.memberships = await call('contact.find', { email: row.email });
  } catch (e) {
    row.memberships = [];
    row.lookupError = message(e);
  }
}

function inBook(row: Row) {
  return !!row.memberships?.some((m) => m.bookId === bookId.value);
}

function statusText(row: Row): string {
  if (row.lookupError) return row.lookupError;
  if (!row.memberships) return 'Checking…';
  if (!row.memberships.length) return 'Not in SendPulse yet';
  const names = row.memberships.map((m) => bookNames.value.get(m.bookId) ?? `#${m.bookId}`);
  return `In: ${names.join(', ')}`;
}

onMounted(async () => {
  try {
    loggedIn.value = (await call('auth.status')).loggedIn;
    if (!loggedIn.value) return;

    const [allBooks, prefs] = await Promise.all([call('books.list'), call('prefs.get')]);
    books.value = allBooks;
    bookId.value = allBooks.some((b) => b.id === prefs.lastBookId)
      ? prefs.lastBookId!
      : (allBooks[0]?.id ?? null);

    await Promise.all(
      rows.map(async (row) => {
        await lookup(row);
        // Prefer what SendPulse already knows when the email header has no name.
        if (!row.firstName && !row.lastName && row.memberships?.length) {
          Object.assign(row, fromVariables(row.memberships[0].variables));
        }
        row.selected = !row.lookupError && !row.memberships?.length;
      }),
    );
  } catch (e) {
    error.value = message(e);
  }
});

watch(bookId, async (id, previous) => {
  nameFields.value = {};
  if (id === null) return;
  if (previous !== undefined && previous !== null) call('prefs.set', { lastBookId: id }).catch(() => {});
  try {
    const variables = await call('books.variables', { bookId: id });
    // Ignore a slow response for a book the user has already switched away from.
    if (id === bookId.value) nameFields.value = detectNameFields(variables);
  } catch (e) {
    error.value = message(e);
  }
});

async function add() {
  if (bookId.value === null || !selectedRows.value.length) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  const added = [...selectedRows.value];
  try {
    await call('contact.add', {
      bookId: bookId.value,
      contacts: added.map((r) => ({ email: r.email, variables: toVariables(r, nameFields.value) })),
    });
    notice.value = `Added ${added.length === 1 ? added[0].email : `${added.length} contacts`} to ${book.value?.name}`;
    added.forEach((r) => (r.selected = false));
    await Promise.all(added.map(lookup));
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}

function openSettings() {
  call('app.openOptions').catch(() => {});
}
</script>

<template>
  <div class="sp-panel">
    <p v-if="loggedIn === false">
      Connect your SendPulse account to see and add contacts.
      <button type="button" class="sp-link" @click="openSettings">Open settings</button>
    </p>

    <template v-else-if="loggedIn">
      <p v-if="!rows.length" class="sp-muted">No other people in this conversation.</p>

      <template v-else>
        <ul class="sp-people">
          <li v-for="row in rows" :key="row.email">
            <label class="sp-head">
              <input v-model="row.selected" type="checkbox" :disabled="busy" />
              <span>
                <span class="sp-name">{{ row.displayName || row.email }}</span>
                <span v-if="row.displayName" class="sp-muted sp-email">{{ row.email }}</span>
              </span>
            </label>
            <div class="sp-status" :class="{ 'sp-error': row.lookupError, 'sp-ok': inBook(row) }">
              {{ statusText(row) }}
            </div>
            <div v-if="row.selected" class="sp-names">
              <input v-model="row.firstName" placeholder="First name" aria-label="First name" />
              <input v-model="row.lastName" placeholder="Last name" aria-label="Last name" />
            </div>
          </li>
        </ul>

        <div class="sp-add">
          <label class="sp-muted" for="sp-book">Address book</label>
          <p v-if="!books.length" class="sp-muted">No address books yet. Create one in SendPulse first.</p>
          <select v-else id="sp-book" v-model="bookId" :disabled="busy">
            <option v-for="b in books" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
          <button
            type="button"
            class="sp-primary"
            :disabled="busy || !book || !selectedRows.length"
            @click="add"
          >
            {{ busy ? 'Adding…' : `Add ${selectedRows.length || ''} to SendPulse` }}
          </button>
        </div>
      </template>
    </template>

    <p v-if="notice" class="sp-ok">{{ notice }}</p>
    <p v-if="error" class="sp-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.sp-panel {
  padding: 12px 16px;
  font:
    14px/1.4 'Google Sans',
    Roboto,
    Arial,
    sans-serif;
  color: #1f1f1f;
}
.sp-people {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sp-people li {
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}
.sp-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  cursor: pointer;
}
.sp-head input {
  margin-top: 3px;
}
.sp-name {
  display: block;
  font-weight: 500;
}
.sp-email {
  display: block;
  word-break: break-all;
}
.sp-muted {
  color: #5f6368;
  font-size: 12px;
}
.sp-status {
  margin: 2px 0 0 24px;
  font-size: 12px;
  color: #5f6368;
}
.sp-names {
  display: flex;
  gap: 6px;
  margin: 6px 0 0 24px;
}
.sp-names input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #c4c7c5;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
}
.sp-add {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.sp-add select {
  padding: 6px;
  border: 1px solid #c4c7c5;
  border-radius: 4px;
  font: inherit;
}
.sp-primary {
  padding: 8px 12px;
  border: 0;
  border-radius: 18px;
  background: #0b57d0;
  color: #fff;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}
.sp-primary:disabled {
  background: #c4c7c5;
  cursor: default;
}
.sp-ok {
  color: #146c2e;
}
.sp-error {
  color: #c5221f;
}
.sp-link {
  border: 0;
  padding: 0;
  background: none;
  color: #0b57d0;
  cursor: pointer;
  font: inherit;
}
</style>
