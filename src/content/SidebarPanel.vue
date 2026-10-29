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
import { t, type MessageKey } from '../shared/i18n';
import type { AddressBook, BookVariable, ContactStats, CrmPipeline, Membership } from '../shared/types';
import SpSelect from '../shared/ui/SpSelect.vue';
import SpTextField from '../shared/ui/SpTextField.vue';
import '../shared/ui/buttons.css';
import FieldMappingEditor from './FieldMappingEditor.vue';
import type { Participant } from './participants';
import { websiteFromEmail } from './signature';

const props = defineProps<{ participants: Participant[]; subject?: string }>();

type Row = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  automated: boolean;
} & Record<DetailField, string> & {
    selected: boolean;
    detailsOpen: boolean;
    /** null while loading */
    memberships: Membership[] | null;
    lookupError: string;
    /** Campaign history; only fetched for people already in SendPulse. */
    stats: ContactStats | null;
    actionsOpen: boolean;
    /** undefined until checked, null if the CRM has no such contact */
    crmId: number | null | undefined;
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
    automated: p.automated,
    phone: p.details.phone ?? '',
    company: p.details.company ?? '',
    title: p.details.title ?? '',
    website: p.details.website ?? (p.automated ? '' : (websiteFromEmail(p.email) ?? '')),
    linkedin: p.details.linkedin ?? '',
    selected: false,
    detailsOpen: false,
    memberships: null,
    lookupError: '',
    stats: null,
    actionsOpen: false,
    crmId: undefined,
  })),
);

const DETAIL_LABELS: Record<DetailField, MessageKey> = {
  phone: 'phone',
  company: 'company',
  title: 'jobTitle',
  website: 'website',
  linkedin: 'linkedin',
};
const busy = ref(false);
const error = ref('');
const notice = ref('');

const book = computed(() => books.value.find((b) => b.id === bookId.value));
const bookOptions = computed(() => books.value.map((b) => ({ value: b.id, label: b.name })));
const selectedRows = computed(() => rows.filter((r) => r.selected));
const bookNames = computed(() => new Map(books.value.map((b) => [b.id, b.name])));
const savedFieldCount = computed(() => Object.keys(mapping.value).length);
const addLabel = computed(() => {
  if (busy.value) return t('adding');
  const n = selectedRows.value.length;
  return n ? t('addButtonCount', n) : t('addButton');
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
  // Statistics are a nice-to-have: a failure here shouldn't hide the contact.
  if (row.memberships.length) row.stats = await call('contact.stats', { email: row.email }).catch(() => null);
}

/** Unsubscribing and blacklisting take a second click, so a stray click can't do it. */
const confirming = ref('');
let confirmTimer: ReturnType<typeof setTimeout> | undefined;

function confirmLabel(key: string, label: string) {
  return confirming.value === key ? t('confirmAgain') : label;
}

async function runAction(key: string, action: () => Promise<string>, needsConfirm = true) {
  if (needsConfirm && confirming.value !== key) {
    confirming.value = key;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirming.value = ''), 4000);
    return;
  }
  confirming.value = '';
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    notice.value = await action();
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}

function unsubscribe(row: Row) {
  const id = bookId.value;
  if (id === null) return;
  runAction(`unsub:${row.email}`, async () => {
    await call('contact.unsubscribe', { bookId: id, email: row.email });
    await lookup(row);
    return t('unsubscribedFrom', row.email, bookNames.value.get(id) ?? '');
  });
}

function toggleBlacklist(row: Row) {
  const blacklisted = !row.stats?.blacklisted;
  runAction(
    `black:${row.email}`,
    async () => {
      await call('contact.blacklist', { email: row.email, blacklisted });
      await lookup(row);
      return t(blacklisted ? 'blacklistAdded' : 'blacklistRemoved', row.email);
    },
    blacklisted,
  );
}

function crmInput(row: Row) {
  return {
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone || undefined,
  };
}

function addToCrm(row: Row) {
  runAction(
    `crm:${row.email}`,
    async () => {
      row.crmId = (await call('crm.addContact', crmInput(row))).id;
      return t('addedToCrm', row.email);
    },
    false,
  );
}

async function openActions(row: Row) {
  row.actionsOpen = !row.actionsOpen;
  if (row.actionsOpen && row.crmId === undefined) {
    row.crmId = await call('crm.findContact', { email: row.email }).catch(() => null);
  }
}

// CRM deal for the checked people. Pipelines load the first time the form opens.
const dealOpen = ref(false);
const pipelines = ref<CrmPipeline[] | null>(null);
const pipelineId = ref<number | null>(null);
const stepId = ref<number | null>(null);
const dealName = ref(props.subject ?? '');
const pipeline = computed(() => pipelines.value?.find((p) => p.id === pipelineId.value));
const pipelineOptions = computed(() => (pipelines.value ?? []).map((p) => ({ value: p.id, label: p.name })));
const stepOptions = computed(() =>
  (pipeline.value?.steps ?? []).map((s) => ({ value: s.id, label: s.name })),
);

async function toggleDeal() {
  dealOpen.value = !dealOpen.value;
  if (!dealOpen.value || pipelines.value) return;
  try {
    const [list, prefs] = await Promise.all([call('crm.pipelines'), call('prefs.get')]);
    pipelines.value = list;
    pipelineId.value = list.some((p) => p.id === prefs.lastPipelineId)
      ? prefs.lastPipelineId!
      : (list[0]?.id ?? null);
  } catch (e) {
    error.value = message(e);
  }
}

watch(pipelineId, (id, previous) => {
  stepId.value = pipeline.value?.steps[0]?.id ?? null;
  if (id !== null && previous !== null) call('prefs.set', { lastPipelineId: id }).catch(() => {});
});

function createDeal() {
  if (pipelineId.value === null || stepId.value === null || !selectedRows.value.length) return;
  const name = dealName.value.trim() || selectedRows.value[0].email;
  const deal = {
    pipelineId: pipelineId.value,
    stepId: stepId.value,
    name,
    contacts: selectedRows.value.map(crmInput),
  };
  runAction(
    'deal',
    async () => {
      await call('crm.createDeal', deal);
      return t('dealCreated', name);
    },
    false,
  );
}

/** SendPulse rejects the whole contact if Phone isn't in international format. */
function phoneWarning(row: Row) {
  const digits = row.phone.replace(/[\s().-]/g, '');
  return mapping.value.phone && digits && !/^\+\d{9,15}$/.test(digits) ? t('phoneWarning') : '';
}

function detailCount(row: Row) {
  return DETAIL_FIELDS.filter((f) => row[f].trim()).length;
}

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

function statsText(row: Row): string {
  const s = row.stats;
  return s && s.sent ? t('stats', s.sent, s.opened, s.clicked) : '';
}

function statusText(row: Row): string {
  if (row.lookupError) return row.lookupError;
  if (!row.memberships) return t('checking');
  const prefix = row.automated ? `${t('automatedSender')} · ` : '';
  if (!row.memberships.length) return prefix + t('notInSendPulse');
  const names = row.memberships.map((m) => bookNames.value.get(m.bookId) ?? `#${m.bookId}`);
  return prefix + t('inLists', names.join(', '));
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
        // Preselect real people who aren't in SendPulse yet; never robots.
        row.selected = !row.automated && !row.lookupError && !row.memberships?.length;
      }),
    );
  } catch (e) {
    error.value = message(e);
  }
}

// Settings live inside the panel as an iframe of the extension's settings page, so the API
// key never lands in Gmail's DOM. The page reports its height and when it (dis)connects.
const settingsUrl = chrome.runtime.getURL('src/options/index.html');
const settingsHeight = ref(260);
const settingsOpen = ref(false);

function onSettingsMessage(event: MessageEvent) {
  if (event.origin !== new URL(settingsUrl).origin) return;
  const type = event.data?.type;
  if (type === 'sendpulse:height') settingsHeight.value = event.data.height;
  if (type === 'sendpulse:connected' || type === 'sendpulse:disconnected') {
    settingsOpen.value = false;
    init();
  }
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
    notice.value = t('addedTo', book.value?.name ?? '', added.length === 1 ? added[0].email : added.length);
    added.forEach((r) => (r.selected = false));
    await Promise.all(added.map(lookup));
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="sp-panel">
    <template v-if="loggedIn === false || settingsOpen">
      <p v-if="loggedIn === false" class="sp-muted">
        {{ t('connectPrompt') }}
      </p>
      <iframe
        class="sp-settings"
        :src="settingsUrl"
        :style="{ height: `${settingsHeight}px` }"
        :title="t('settingsTitle')"
      ></iframe>
      <button
        v-if="settingsOpen"
        type="button"
        class="sp-btn sp-btn--text sp-btn--small sp-back"
        @click="settingsOpen = false"
      >
        {{ t('backToContacts') }}
      </button>
    </template>

    <template v-else-if="loggedIn">
      <p v-if="!rows.length" class="sp-muted">{{ t('noParticipants') }}</p>

      <template v-else>
        <ul class="sp-people">
          <li v-for="row in rows" :key="row.email">
            <input
              :id="`sp-pick-${row.email}`"
              v-model="row.selected"
              class="sp-checkbox"
              type="checkbox"
              :disabled="busy"
            />
            <div class="sp-body">
              <label :for="`sp-pick-${row.email}`">
                <span class="sp-name">{{ row.displayName || row.email }}</span>
                <span v-if="row.displayName" class="sp-muted sp-email">{{ row.email }}</span>
              </label>
              <div class="sp-status" :class="{ 'sp-error': row.lookupError, 'sp-ok': inBook(row) }">
                {{ statusText(row) }}
              </div>
              <div v-if="statsText(row) || row.stats?.blacklisted" class="sp-status">
                <span v-if="row.stats?.blacklisted" class="sp-badge">{{ t('blacklisted') }}</span>
                {{ statsText(row) }}
              </div>

              <div v-if="row.selected" class="sp-fields">
                <div class="sp-names">
                  <SpTextField v-model="row.firstName" :label="t('firstName')" />
                  <SpTextField v-model="row.lastName" :label="t('lastName')" />
                </div>
                <button
                  type="button"
                  class="sp-btn sp-btn--text sp-btn--small sp-toggle"
                  :aria-expanded="row.detailsOpen"
                  @click="row.detailsOpen = !row.detailsOpen"
                >
                  {{ row.detailsOpen ? '▾' : '▸' }} {{ t('details') }}
                  <span v-if="detailCount(row)" class="sp-muted"
                    >({{ t('detailsFound', detailCount(row)) }})</span
                  >
                </button>
                <template v-if="row.detailsOpen">
                  <SpTextField
                    v-for="f in DETAIL_FIELDS"
                    :key="f"
                    v-model="row[f]"
                    :label="t(DETAIL_LABELS[f])"
                    :hint="mapping[f] ? undefined : t('notSavedHint')"
                    :warning="f === 'phone' ? phoneWarning(row) : undefined"
                  >
                    <template v-if="f === 'linkedin'" #trailing>
                      <button
                        type="button"
                        class="sp-btn sp-btn--text sp-btn--small"
                        :title="t('findOnLinkedinTitle')"
                        @click="findOnLinkedin(row)"
                      >
                        {{ t('find') }}
                      </button>
                    </template>
                  </SpTextField>
                </template>
              </div>
              <template v-if="row.memberships && !row.lookupError">
                <button
                  type="button"
                  class="sp-btn sp-btn--text sp-btn--small sp-toggle sp-actions-toggle"
                  :aria-expanded="row.actionsOpen"
                  @click="openActions(row)"
                >
                  {{ row.actionsOpen ? '▾' : '▸' }} {{ t('actions') }}
                </button>
                <div v-if="row.actionsOpen" class="sp-actions">
                  <button
                    v-if="inBook(row)"
                    type="button"
                    class="sp-btn sp-btn--outlined sp-btn--small"
                    :disabled="busy"
                    @click="unsubscribe(row)"
                  >
                    {{ confirmLabel(`unsub:${row.email}`, t('unsubscribeFrom', book?.name ?? '')) }}
                  </button>
                  <button
                    type="button"
                    class="sp-btn sp-btn--outlined sp-btn--small"
                    :disabled="busy"
                    @click="toggleBlacklist(row)"
                  >
                    {{
                      row.stats?.blacklisted
                        ? t('removeFromBlacklist')
                        : confirmLabel(`black:${row.email}`, t('addToBlacklist'))
                    }}
                  </button>
                  <span v-if="row.crmId" class="sp-muted sp-crm">✓ {{ t('inCrm') }}</span>
                  <button
                    v-else-if="row.crmId === null"
                    type="button"
                    class="sp-btn sp-btn--outlined sp-btn--small"
                    :disabled="busy"
                    @click="addToCrm(row)"
                  >
                    {{ t('addToCrm') }}
                  </button>
                </div>
              </template>
            </div>
          </li>
        </ul>

        <div class="sp-add">
          <p v-if="!books.length" class="sp-muted">{{ t('noListsPanel') }}</p>
          <template v-else>
            <SpSelect v-model="bookId" :label="t('mailingList')" :options="bookOptions" :disabled="busy" />
            <button
              type="button"
              class="sp-btn sp-btn--text sp-btn--small sp-toggle"
              :aria-expanded="mappingOpen"
              @click="mappingOpen = !mappingOpen"
            >
              {{ mappingOpen ? '▾' : '▸' }} {{ t('fields') }}
              <span class="sp-muted">({{ t('fieldsSaved', savedFieldCount) }})</span>
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
            class="sp-btn sp-btn--filled sp-btn--block"
            :disabled="busy || !book || !selectedRows.length"
            @click="add"
          >
            {{ addLabel }}
          </button>

          <button
            type="button"
            class="sp-btn sp-btn--text sp-btn--small sp-toggle"
            :aria-expanded="dealOpen"
            @click="toggleDeal"
          >
            {{ dealOpen ? '▾' : '▸' }} {{ t('crmDeal') }}
          </button>
          <template v-if="dealOpen && pipelines">
            <p v-if="!pipelines.length" class="sp-muted">{{ t('noPipelines') }}</p>
            <template v-else>
              <SpSelect
                v-model="pipelineId"
                :label="t('pipeline')"
                :options="pipelineOptions"
                :disabled="busy"
              />
              <SpSelect v-model="stepId" :label="t('stage')" :options="stepOptions" :disabled="busy" />
              <SpTextField v-model="dealName" :label="t('dealName')" :hint="t('dealHint')" />
              <button
                type="button"
                class="sp-btn sp-btn--outlined sp-btn--block"
                :disabled="busy || stepId === null || !selectedRows.length"
                @click="createDeal"
              >
                {{ t('createDeal') }}
              </button>
            </template>
          </template>
        </div>
      </template>

      <p v-if="notice" class="sp-ok" role="status">{{ notice }}</p>
      <p v-if="error" class="sp-error" role="alert">{{ error }}</p>
      <button type="button" class="sp-btn sp-btn--text sp-btn--small sp-footer" @click="settingsOpen = true">
        {{ t('settingsTitle') }}
      </button>
    </template>

    <p v-else-if="error" class="sp-error" role="alert">{{ error }}</p>
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
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
}
.sp-people li > .sp-checkbox {
  margin-top: 2px;
}
.sp-body {
  flex: 1;
  min-width: 0;
}
.sp-body > label {
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
  font-weight: normal;
}
.sp-status {
  margin-top: 2px;
  font-size: 12px;
  color: #5f6368;
}
.sp-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 14px;
}
.sp-names {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sp-toggle {
  align-self: flex-start;
  margin: -6px 0 -6px -12px;
}
.sp-add {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
.sp-settings {
  display: block;
  width: 100%;
  border: 0;
}
.sp-back,
.sp-footer {
  margin: 12px 0 0 -12px;
}
.sp-actions-toggle {
  margin-top: 4px;
}
.sp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.sp-crm {
  align-self: center;
}
.sp-badge {
  margin-right: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #fce8e6;
  color: #c5221f;
}
.sp-ok {
  color: #146c2e;
}
.sp-error {
  color: #c5221f;
}
</style>
