<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { call } from '../shared/messages';
import {
  DETAIL_FIELDS,
  detectFieldMapping,
  fromVariables,
  toVariables,
  type DetailField,
  type FieldMapping,
} from '../shared/fields';
import type { AddressBook, BookVariable, Membership } from '../shared/types';
import FieldMappingEditor from './FieldMappingEditor.vue';
import type { Participant } from './participants';
import { websiteFromEmail } from './signature';

const props = defineProps<{ participants: Participant[] }>();

type Row = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
} & Record<DetailField, string> & {
    selected: boolean;
    detailsOpen: boolean;
    /** null while loading */
    memberships: Membership[] | null;
    lookupError: string;
  };

const loggedIn = ref<boolean | null>(null);
const books = ref<AddressBook[]>([]);
const bookId = ref<number | null>(null);
const bookVariables = ref<BookVariable[]>([]);
const mapping = ref<FieldMapping>({});
const savedMappings = ref<Record<string, FieldMapping>>({});
const mappingOpen = ref(false);
const rows = reactive<Row[]>(
  props.participants.map((p) => ({
    email: p.email,
    displayName: p.name,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.details.phone ?? '',
    company: p.details.company ?? '',
    title: p.details.title ?? '',
    website: p.details.website ?? websiteFromEmail(p.email) ?? '',
    linkedin: p.details.linkedin ?? '',
    selected: false,
    detailsOpen: false,
    memberships: null,
    lookupError: '',
  })),
);

const DETAIL_LABELS: Record<DetailField, string> = {
  phone: 'Phone',
  company: 'Company',
  title: 'Job title',
  website: 'Website',
  linkedin: 'LinkedIn',
};
const busy = ref(false);
const error = ref('');
const notice = ref('');

const book = computed(() => books.value.find((b) => b.id === bookId.value));
const selectedRows = computed(() => rows.filter((r) => r.selected));
const bookNames = computed(() => new Map(books.value.map((b) => [b.id, b.name])));
const addLabel = computed(() => {
  if (busy.value) return 'Adding…';
  const n = selectedRows.value.length;
  return n ? `Add ${n} to SendPulse` : 'Add to SendPulse';
});

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

/** SendPulse rejects the whole contact if Phone isn't in international format. */
function phoneWarning(row: Row) {
  const digits = row.phone.replace(/[\s().-]/g, '');
  return mapping.value.phone && digits && !/^\+\d{9,15}$/.test(digits)
    ? 'Use international format, e.g. +380671234567'
    : '';
}

function detailCount(row: Row) {
  return DETAIL_FIELDS.filter((f) => row[f].trim()).length;
}

const savedFieldCount = computed(() => Object.keys(mapping.value).length);

/** Opens LinkedIn's own people search; we never fetch LinkedIn pages ourselves. */
function findOnLinkedin(row: Row) {
  const keywords = [row.firstName, row.lastName, row.company].filter(Boolean).join(' ') || row.email;
  window.open(
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`,
    '_blank',
    'noopener',
  );
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

async function init() {
  error.value = '';
  try {
    loggedIn.value = (await call('auth.status')).loggedIn;
    if (!loggedIn.value) return;

    const [allBooks, prefs] = await Promise.all([call('books.list'), call('prefs.get')]);
    books.value = allBooks;
    savedMappings.value = prefs.mappings ?? {};
    bookId.value = allBooks.some((b) => b.id === prefs.lastBookId)
      ? prefs.lastBookId!
      : (allBooks[0]?.id ?? null);

    await Promise.all(
      rows.map(async (row) => {
        await lookup(row);
        // Fill gaps with what SendPulse already knows; fresh data from the email wins.
        if (row.memberships?.length) {
          const known = fromVariables(row.memberships[0].variables);
          if (!row.firstName && !row.lastName) {
            row.firstName = known.firstName;
            row.lastName = known.lastName;
            row.displayName ||= `${row.firstName} ${row.lastName}`.trim();
          }
          for (const f of DETAIL_FIELDS) if (!row[f] && known[f]) row[f] = known[f];
        }
        row.selected = !row.lookupError && !row.memberships?.length;
      }),
    );
  } catch (e) {
    error.value = message(e);
  }
}

// When not connected, the settings page is embedded below as an iframe (an extension page,
// so the API key never lands in Gmail's DOM). It tells us when it connects and how tall it is.
const settingsUrl = chrome.runtime.getURL('src/options/index.html');
const settingsHeight = ref(260);

function onSettingsMessage(event: MessageEvent) {
  if (event.origin !== new URL(settingsUrl).origin) return;
  if (event.data?.type === 'sendpulse:height') settingsHeight.value = event.data.height;
  if (event.data?.type === 'sendpulse:connected') init();
}

onMounted(() => {
  window.addEventListener('message', onSettingsMessage);
  init();
});
onUnmounted(() => window.removeEventListener('message', onSettingsMessage));

watch(bookId, async (id, previous) => {
  mapping.value = {};
  bookVariables.value = [];
  if (id === null) return;
  if (previous !== undefined && previous !== null) call('prefs.set', { lastBookId: id }).catch(() => {});
  try {
    const variables = await call('books.variables', { bookId: id });
    // Ignore a slow response for a book the user has already switched away from.
    if (id !== bookId.value) return;
    bookVariables.value = variables;
    mapping.value = savedMappings.value[id] ?? detectFieldMapping(variables);
  } catch (e) {
    error.value = message(e);
  }
});

function onMappingChange(next: FieldMapping) {
  if (bookId.value === null) return;
  mapping.value = next;
  savedMappings.value = { ...savedMappings.value, [bookId.value]: next };
  call('prefs.set', { mappings: savedMappings.value }).catch((e) => (error.value = message(e)));
}

async function add() {
  if (bookId.value === null || !selectedRows.value.length) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  const added = [...selectedRows.value];
  try {
    await call('contact.add', {
      bookId: bookId.value,
      contacts: added.map((r) => ({ email: r.email, variables: toVariables(r, mapping.value) })),
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
    <template v-if="loggedIn === false">
      <p class="sp-muted">Connect your SendPulse account to see and add contacts.</p>
      <iframe
        class="sp-settings"
        :src="settingsUrl"
        :style="{ height: `${settingsHeight}px` }"
        title="Connect SendPulse"
      ></iframe>
    </template>

    <template v-else-if="loggedIn">
      <p v-if="!rows.length" class="sp-muted">No other people in this conversation.</p>

      <template v-else>
        <ul class="sp-people">
          <li v-for="row in rows" :key="row.email">
            <input :id="`sp-pick-${row.email}`" v-model="row.selected" type="checkbox" :disabled="busy" />
            <div class="sp-body">
              <label :for="`sp-pick-${row.email}`">
                <span class="sp-name">{{ row.displayName || row.email }}</span>
                <span v-if="row.displayName" class="sp-muted sp-email">{{ row.email }}</span>
              </label>
              <div class="sp-status" :class="{ 'sp-error': row.lookupError, 'sp-ok': inBook(row) }">
                {{ statusText(row) }}
              </div>
              <template v-if="row.selected">
                <div class="sp-names">
                  <input v-model="row.firstName" placeholder="First name" aria-label="First name" />
                  <input v-model="row.lastName" placeholder="Last name" aria-label="Last name" />
                </div>
                <button
                  type="button"
                  class="sp-link sp-toggle"
                  :aria-expanded="row.detailsOpen"
                  @click="row.detailsOpen = !row.detailsOpen"
                >
                  {{ row.detailsOpen ? '▾' : '▸' }} Details
                  <span class="sp-muted">{{ detailCount(row) ? `(${detailCount(row)} found)` : '' }}</span>
                </button>
                <div v-if="row.detailsOpen" class="sp-details">
                  <label v-for="f in DETAIL_FIELDS" :key="f">
                    <span>
                      {{ DETAIL_LABELS[f] }}
                      <span v-if="!mapping[f]" class="sp-muted" title="Choose a variable under “Fields”">
                        · not saved
                      </span>
                    </span>
                    <span class="sp-input-row">
                      <input v-model="row[f]" :aria-label="DETAIL_LABELS[f]" />
                      <button
                        v-if="f === 'linkedin'"
                        type="button"
                        class="sp-small"
                        title="Search LinkedIn in a new tab"
                        @click="findOnLinkedin(row)"
                      >
                        Find
                      </button>
                    </span>
                    <span v-if="f === 'phone' && phoneWarning(row)" class="sp-warn">
                      {{ phoneWarning(row) }}
                    </span>
                  </label>
                </div>
              </template>
            </div>
          </li>
        </ul>

        <div class="sp-add">
          <label class="sp-muted" for="sp-book">Address book</label>
          <p v-if="!books.length" class="sp-muted">No address books yet. Create one in SendPulse first.</p>
          <template v-else>
            <select id="sp-book" v-model="bookId" :disabled="busy">
              <option v-for="b in books" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
            <button
              type="button"
              class="sp-link sp-toggle"
              :aria-expanded="mappingOpen"
              @click="mappingOpen = !mappingOpen"
            >
              {{ mappingOpen ? '▾' : '▸' }} Fields
              <span class="sp-muted">({{ savedFieldCount }} saved to this book)</span>
            </button>
            <FieldMappingEditor
              v-if="mappingOpen"
              :model-value="mapping"
              :variables="bookVariables"
              :disabled="busy"
              @update:model-value="onMappingChange"
            />
          </template>
          <button
            type="button"
            class="sp-primary"
            :disabled="busy || !book || !selectedRows.length"
            @click="add"
          >
            {{ addLabel }}
          </button>
        </div>
      </template>
    </template>

    <p v-if="notice" class="sp-ok">{{ notice }}</p>
    <p v-if="error" class="sp-error">{{ error }}</p>
    <button v-if="loggedIn" type="button" class="sp-link sp-footer" @click="openSettings">
      SendPulse settings
    </button>
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
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}
.sp-people li > input {
  margin: 3px 0 0;
}
.sp-body {
  flex: 1;
  min-width: 0;
}
.sp-body label {
  cursor: pointer;
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
  margin-top: 2px;
  font-size: 12px;
  color: #5f6368;
}
.sp-names {
  display: flex;
  gap: 6px;
  margin-top: 6px;
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
.sp-toggle {
  margin-top: 6px;
  font-size: 12px;
  text-align: left;
}
.sp-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
}
.sp-details label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #5f6368;
}
.sp-input-row {
  display: flex;
  gap: 4px;
}
.sp-details input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #c4c7c5;
  border-radius: 4px;
  color: #1f1f1f;
  font: inherit;
  font-size: 13px;
}
.sp-warn {
  color: #b06000;
}
.sp-small {
  padding: 2px 10px;
  border: 1px solid #c4c7c5;
  border-radius: 12px;
  background: #fff;
  color: #0b57d0;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.sp-settings {
  display: block;
  width: 100%;
  border: 0;
}
.sp-footer {
  margin-top: 16px;
  font-size: 12px;
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
