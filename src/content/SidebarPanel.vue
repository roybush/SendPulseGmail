<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { call } from '../shared/messages';
import {
  DETAIL_FIELDS,
  detectFieldMapping,
  fromVariables,
  sourceLabel,
  variableChanges,
  toVariables,
  type DetailField,
  type FieldMapping,
} from '../shared/fields';
import { t, uiLanguage, type MessageKey } from '../shared/i18n';
import type {
  Account,
  AddressBook,
  BookVariable,
  ChatbotSubscription,
  ContactStats,
  CrmPipeline,
  EmailNote,
  EnrichmentStatus,
  Membership,
  Prefs,
  Sender,
} from '../shared/types';
import SpSelect from '../shared/ui/SpSelect.vue';
import SpTextField from '../shared/ui/SpTextField.vue';
import '../shared/ui/buttons.css';
import FieldMappingEditor from './FieldMappingEditor.vue';
import type { Participant } from './participants';
import { websiteFromEmail } from './signature';
import { forEachLimit } from '../shared/limit';
import { toCsv } from '../shared/csv';

const props = defineProps<{
  participants: Participant[];
  subject?: string;
  /** The open email; enables saving it and reminders to the CRM. */
  email?: EmailNote;
  /** Many people from checked threads: name fields stay folded until asked for. */
  bulk?: boolean;
  /** Gmail label the people come from; its list choice is remembered. */
  label?: string;
}>();

type Row = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  automated: boolean;
} & Record<DetailField, string> & {
    selected: boolean;
    detailsOpen: boolean;
    /** Bulk mode: show the name fields for this person. */
    editing: boolean;
    /** null while loading */
    memberships: Membership[] | null;
    lookupError: string;
    /** Campaign history; only fetched for people already in SendPulse. */
    stats: ContactStats | null;
    actionsOpen: boolean;
    /** Chatbot subscriptions; null until checked on request. */
    chatbots: ChatbotSubscription[] | null;
    /** Result of the last action on this person, shown right under them. */
    feedback: { text: string; error: boolean } | null;
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
    editing: false,
    memberships: null,
    lookupError: '',
    stats: null,
    actionsOpen: false,
    crmId: undefined,
    chatbots: null,
    feedback: null,
  })),
);

const DETAIL_LABELS: Record<DetailField, MessageKey> = {
  phone: 'phone',
  company: 'company',
  title: 'jobTitle',
  website: 'website',
  linkedin: 'linkedin',
};
// Double opt-in: on when a sender is chosen; senders load the first time it's switched on.
const optInSender = ref('');
const senders = ref<Sender[] | null>(null);
const senderOptions = computed(() =>
  (senders.value ?? []).map((s) => ({ value: s.email, label: s.name ? `${s.name} <${s.email}>` : s.email })),
);

async function loadSenders() {
  if (senders.value) return;
  try {
    senders.value = await call('senders.list');
  } catch (e) {
    senders.value = [];
    error.value = message(e);
  }
}

async function toggleOptIn(on: boolean) {
  if (on) {
    await loadSenders();
    optInSender.value = senders.value?.[0]?.email ?? '';
  } else {
    optInSender.value = '';
  }
  call('prefs.set', { optInSender: optInSender.value || undefined }).catch(() => {});
}

function onSenderChange(email: string | null) {
  optInSender.value = email ?? '';
  call('prefs.set', { optInSender: optInSender.value || undefined }).catch(() => {});
}

const LOOKUP_CONCURRENCY = 4;
const busy = ref(false);

function selectAll(selected: boolean) {
  for (const row of rows) row.selected = selected && !row.automated;
}
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

/** Key of the action in progress, so its button can say so. */
const running = ref('');

function actionLabel(key: string, label: string) {
  if (running.value === key) return t('working');
  return confirming.value === key ? t('confirmAgain') : label;
}

/**
 * Person actions are keyed "<action>:<email>" and report under that person; the rest (deal, undo)
 * report at the bottom of the panel.
 */
async function runAction(key: string, action: () => Promise<string>, needsConfirm = true) {
  if (needsConfirm && confirming.value !== key) {
    confirming.value = key;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirming.value = ''), 4000);
    return;
  }
  const row = rows.find((r) => key === `${key.split(':')[0]}:${r.email}`);
  confirming.value = '';
  running.value = key;
  busy.value = true;
  error.value = '';
  notice.value = '';
  if (row) row.feedback = null;
  try {
    const text = await action();
    if (row) row.feedback = text ? { text, error: false } : null;
    else notice.value = text;
  } catch (e) {
    if (row) row.feedback = { text: message(e), error: true };
    else error.value = message(e);
  } finally {
    busy.value = false;
    running.value = '';
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

/** What this email would change for a person already in the selected book. */
function changes(row: Row) {
  const current = row.memberships?.find((m) => m.bookId === bookId.value)?.variables;
  if (!current) return [];
  // No source label here: it records when a contact was added, not edited.
  return variableChanges(toVariables(row, mapping.value), current);
}

function updateContact(row: Row) {
  const id = bookId.value;
  if (id === null) return;
  const variables = Object.fromEntries(changes(row).map((c) => [c.name, c.to]));
  runAction(
    `update:${row.email}`,
    async () => {
      await call('contact.update', { bookId: id, email: row.email, variables });
      await lookup(row);
      return t('contactUpdated', row.email);
    },
    false,
  );
}

// Automation 360: event names are the user's own, typed once and then offered again.
const MAX_SAVED_EVENTS = 5;
const eventName = ref('');
const savedEvents = ref<string[]>([]);

/** Data an Automation 360 flow can use; email identifies the contact. */
function eventVariables(row: Row): Record<string, string> {
  const vars: Record<string, string> = {
    email: row.email,
    phone: row.phone.replace(/[\s().-]/g, ''),
    first_name: row.firstName,
    last_name: row.lastName,
    company: row.company,
    title: row.title,
    website: row.website,
    linkedin: row.linkedin,
  };
  return Object.fromEntries(Object.entries(vars).filter(([, v]) => v.trim()));
}

function sendEvent(row: Row) {
  const event = eventName.value.trim();
  if (!event) return;
  runAction(`event:${row.email}`, async () => {
    await call('automation.event', { event, variables: eventVariables(row) });
    savedEvents.value = [event, ...savedEvents.value.filter((e) => e !== event)].slice(0, MAX_SAVED_EVENTS);
    call('prefs.set', { automationEvents: savedEvents.value }).catch(() => {});
    return t('eventSent', event, row.email);
  });
}

function checkChatbots(row: Row) {
  runAction(
    `bots:${row.email}`,
    async () => {
      row.chatbots = await call('contact.chatbots', { email: row.email });
      return '';
    },
    false,
  );
}

async function ensureCrmContact(row: Row): Promise<number> {
  row.crmId ||= (await call('crm.addContact', crmInput(row))).id;
  return row.crmId;
}

const NOTE_TEXT_LIMIT = 1500;

function saveEmailToCrm(row: Row) {
  const email = props.email;
  if (!email) return;
  runAction(
    `note:${row.email}`,
    async () => {
      const text =
        email.text.length > NOTE_TEXT_LIMIT ? `${email.text.slice(0, NOTE_TEXT_LIMIT)}…` : email.text;
      const message = [`✉ ${email.subject}`, email.url, text].filter(Boolean).join('\n\n');
      await call('crm.addComment', { contactId: await ensureCrmContact(row), message });
      return t('emailSavedToCrm', row.email);
    },
    false,
  );
}

// Follow-up reminder: a CRM task in the first column of the first task board.
const REMINDER_DAYS = [1, 3, 7, 14];
const reminderDays = ref(3);
const reminderOptions = REMINDER_DAYS.map((d) => ({ value: d, label: t('inDays', d) }));

function createReminder(row: Row) {
  const email = props.email;
  runAction(
    `task:${row.email}`,
    async () => {
      const board = (await call('crm.boards')).find((b) => b.steps.length);
      if (!board) throw new Error(t('noBoards'));
      const due = new Date(Date.now() + reminderDays.value * 86_400_000);
      await call('crm.createTask', {
        boardId: board.id,
        stepId: board.steps[0].id,
        name: t('followUpTask', row.displayName || row.email),
        description: email ? `${email.subject}\n${email.url}` : undefined,
        finishAt: due.toISOString(),
        contactIds: [await ensureCrmContact(row)],
      });
      return t('reminderCreated', due.toLocaleDateString(uiLanguage()));
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

const enrichment = ref<EnrichmentStatus>(null);
const PROVIDER_NAMES = { hunter: 'Hunter', apollo: 'Apollo' } as const;

/** Fills only empty fields: what the email and SendPulse say wins over a provider's guess. */
function enrichRow(row: Row) {
  runAction(
    `enrich:${row.email}`,
    async () => {
      const found = await call('enrich.person', { email: row.email });
      if (!found) return t('nothingFound');
      let filled = 0;
      for (const key of ['firstName', 'lastName', ...DETAIL_FIELDS] as const) {
        const value = found[key];
        if (value && !row[key].trim()) {
          row[key] = value;
          filled++;
        }
      }
      if (!row.displayName) row.displayName = `${row.firstName} ${row.lastName}`.trim();
      return filled ? t('fieldsFilled', filled) : t('nothingNew');
    },
    false,
  );
}

/** Checked people, or everyone if nobody is checked, as a CSV download. */
function exportCsv() {
  const people = selectedRows.value.length ? selectedRows.value : rows;
  const header = ['email', 'first_name', 'last_name', ...DETAIL_FIELDS, 'sendpulse_lists'];
  const lines = people.map((r) => [
    r.email,
    r.firstName,
    r.lastName,
    ...DETAIL_FIELDS.map((f) => r[f]),
    (r.memberships ?? []).map((m) => bookNames.value.get(m.bookId) ?? `#${m.bookId}`).join('; '),
  ]);
  const url = URL.createObjectURL(new Blob([toCsv([header, ...lines])], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sendpulse-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const accounts = ref<Account[]>([]);
const accountOptions = computed(() => accounts.value.map((a) => ({ value: a.label, label: a.label })));
const activeAccount = computed(() => accounts.value.find((a) => a.active)?.label ?? null);

async function switchAccount(label: string | null) {
  if (!label || label === activeAccount.value) return;
  busy.value = true;
  try {
    await call('auth.switch', { label });
    // Everything below belongs to the previous account.
    notice.value = '';
    undo.value = null;
    pipelines.value = null;
    senders.value = null;
    for (const row of rows) Object.assign(row, { stats: null, crmId: undefined, chatbots: null });
    await init();
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}

async function init() {
  error.value = '';
  try {
    loggedIn.value = (await call('auth.status')).loggedIn;
    if (!loggedIn.value) return;
    accounts.value = await call('auth.accounts');
    enrichment.value = await call('enrich.status').catch(() => null);

    const [allBooks, prefs] = await Promise.all([call('books.list'), call('prefs.get')]);
    books.value = allBooks;
    savedMappings.value = prefs.mappings ?? {};
    savedEvents.value = prefs.automationEvents ?? [];
    eventName.value = savedEvents.value[0] ?? '';
    if (prefs.optInSender) {
      optInSender.value = prefs.optInSender;
      loadSenders();
    }
    labelBooks.value = prefs.labelBooks ?? {};
    const preferred = (props.label && labelBooks.value[props.label]) || prefs.lastBookId;
    bookId.value = allBooks.some((b) => b.id === preferred) ? preferred! : (allBooks[0]?.id ?? null);

    await forEachLimit(rows, LOOKUP_CONCURRENCY, async (row) => {
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
    });
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

const labelBooks = ref<Record<string, number>>({});

watch(bookId, async (id, previous) => {
  mapping.value = {};
  bookVariables.value = [];
  if (id === null) return;
  if (previous !== undefined && previous !== null) {
    const update: Prefs = { lastBookId: id };
    if (props.label) {
      labelBooks.value = { ...labelBooks.value, [props.label]: id };
      update.labelBooks = labelBooks.value;
    }
    call('prefs.set', update).catch(() => {});
  }
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

// Undo removes only people this click put into the list, never ones who were there before.
const UNDO_MS = 10_000;
const undo = ref<{ bookId: number; rows: Row[] } | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | undefined;

function offerUndo(id: number, rows: Row[]) {
  clearTimeout(undoTimer);
  undo.value = rows.length ? { bookId: id, rows } : null;
  undoTimer = setTimeout(() => (undo.value = null), UNDO_MS);
}

async function undoAdd() {
  const pending = undo.value;
  if (!pending) return;
  undo.value = null;
  clearTimeout(undoTimer);
  await runAction(
    'undo',
    async () => {
      await call('contact.remove', { bookId: pending.bookId, emails: pending.rows.map((r) => r.email) });
      pending.rows.forEach((r) => (r.selected = true));
      await forEachLimit(pending.rows, LOOKUP_CONCURRENCY, lookup);
      return t('addUndone');
    },
    false,
  );
}

async function add() {
  if (bookId.value === null || !selectedRows.value.length) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  undo.value = null;
  const added = [...selectedRows.value];
  const newcomers = added.filter((r) => !inBook(r));
  try {
    const source = sourceLabel(new Date());
    await call('contact.add', {
      bookId: bookId.value,
      contacts: added.map((r) => ({ email: r.email, variables: toVariables(r, mapping.value, source) })),
      optIn: optInSender.value ? { senderEmail: optInSender.value, lang: uiLanguage() } : undefined,
    });
    const who = added.length === 1 ? added[0].email : added.length;
    notice.value = optInSender.value ? t('confirmationSent', who) : t('addedTo', book.value?.name ?? '', who);
    added.forEach((r) => (r.selected = false));
    offerUndo(bookId.value, newcomers);
    await forEachLimit(added, LOOKUP_CONCURRENCY, lookup);
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
        <SpSelect
          v-if="accounts.length > 1"
          class="sp-account"
          :model-value="activeAccount"
          :label="t('account')"
          :options="accountOptions"
          :disabled="busy"
          @update:model-value="switchAccount"
        />
        <div v-if="bulk" class="sp-bulkbar">
          <span class="sp-muted">{{ t('selectedCount', selectedRows.length, rows.length) }}</span>
          <button type="button" class="sp-btn sp-btn--text sp-btn--small" @click="selectAll(true)">
            {{ t('selectAll') }}
          </button>
          <button type="button" class="sp-btn sp-btn--text sp-btn--small" @click="selectAll(false)">
            {{ t('selectNone') }}
          </button>
        </div>
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

              <button
                v-if="bulk && row.selected"
                type="button"
                class="sp-btn sp-btn--text sp-btn--small sp-toggle sp-actions-toggle"
                :aria-expanded="row.editing"
                @click="row.editing = !row.editing"
              >
                {{ row.editing ? '▾' : '▸' }} {{ t('edit') }}
              </button>
              <div v-if="row.selected && (!bulk || row.editing)" class="sp-fields">
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
                  <button
                    v-if="enrichment"
                    type="button"
                    class="sp-btn sp-btn--outlined sp-btn--small sp-enrich"
                    :disabled="busy"
                    @click="enrichRow(row)"
                  >
                    {{
                      actionLabel(`enrich:${row.email}`, t('fillFrom', PROVIDER_NAMES[enrichment.provider]))
                    }}
                  </button>
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
              <div v-if="changes(row).length" class="sp-changes">
                <div class="sp-muted">{{ t('newerDetails') }}</div>
                <ul>
                  <li v-for="c in changes(row)" :key="c.name">
                    <b>{{ c.name }}:</b>
                    <s v-if="c.from">{{ c.from }}</s> → {{ c.to }}
                  </li>
                </ul>
                <button
                  type="button"
                  class="sp-btn sp-btn--outlined sp-btn--small"
                  :disabled="busy"
                  @click="updateContact(row)"
                >
                  {{ actionLabel(`update:${row.email}`, t('updateInList', book?.name ?? '')) }}
                </button>
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
                    {{ actionLabel(`unsub:${row.email}`, t('unsubscribeFrom', book?.name ?? '')) }}
                  </button>
                  <button
                    type="button"
                    class="sp-btn sp-btn--outlined sp-btn--small"
                    :disabled="busy"
                    @click="toggleBlacklist(row)"
                  >
                    {{
                      actionLabel(
                        `black:${row.email}`,
                        row.stats?.blacklisted ? t('removeFromBlacklist') : t('addToBlacklist'),
                      )
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
                    {{ actionLabel(`crm:${row.email}`, t('addToCrm')) }}
                  </button>
                  <template v-if="email">
                    <button
                      type="button"
                      class="sp-btn sp-btn--outlined sp-btn--small"
                      :disabled="busy"
                      @click="saveEmailToCrm(row)"
                    >
                      {{ actionLabel(`note:${row.email}`, t('saveEmailToCrm')) }}
                    </button>
                    <div class="sp-reminder">
                      <SpSelect
                        v-model="reminderDays"
                        :label="t('reminder')"
                        :options="reminderOptions"
                        :disabled="busy"
                      />
                      <button
                        type="button"
                        class="sp-btn sp-btn--outlined sp-btn--small"
                        :disabled="busy"
                        @click="createReminder(row)"
                      >
                        {{ actionLabel(`task:${row.email}`, t('createReminder')) }}
                      </button>
                    </div>
                  </template>
                  <button
                    v-if="!row.chatbots"
                    type="button"
                    class="sp-btn sp-btn--outlined sp-btn--small"
                    :disabled="busy"
                    @click="checkChatbots(row)"
                  >
                    {{ actionLabel(`bots:${row.email}`, t('checkMessengers')) }}
                  </button>
                  <div v-else class="sp-bots">
                    <template v-if="row.chatbots.length">
                      <div v-for="b in row.chatbots" :key="b.channel + b.bot">
                        {{ b.channel }} · {{ b.bot }} —
                        <span :class="b.active ? 'sp-ok' : 'sp-muted'">{{
                          b.active ? t('subscribed') : t('notSubscribed')
                        }}</span>
                      </div>
                    </template>
                    <span v-else class="sp-muted">{{ t('noMessengers') }}</span>
                  </div>
                  <div class="sp-reminder">
                    <SpTextField
                      v-model="eventName"
                      :label="t('automationEvent')"
                      :list="`sp-events-${row.email}`"
                    />
                    <button
                      type="button"
                      class="sp-btn sp-btn--outlined sp-btn--small"
                      :disabled="busy || !eventName.trim()"
                      :title="t('automationHint')"
                      @click="sendEvent(row)"
                    >
                      {{ actionLabel(`event:${row.email}`, t('runAutomation')) }}
                    </button>
                    <datalist :id="`sp-events-${row.email}`">
                      <option v-for="e in savedEvents" :key="e" :value="e" />
                    </datalist>
                  </div>
                </div>
              </template>
              <p
                v-if="row.feedback"
                class="sp-feedback"
                :class="row.feedback.error ? 'sp-error' : 'sp-ok'"
                :role="row.feedback.error ? 'alert' : 'status'"
              >
                {{ row.feedback.error ? '⚠' : '✓' }} {{ row.feedback.text }}
              </p>
            </div>
          </li>
        </ul>

        <div class="sp-add">
          <p v-if="!books.length" class="sp-muted">{{ t('noListsPanel') }}</p>
          <template v-else>
            <SpSelect v-model="bookId" :label="t('mailingList')" :options="bookOptions" :disabled="busy" />
            <p v-if="label" class="sp-muted sp-hint">{{ t('labelRemembered', label) }}</p>
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
            <label class="sp-optin">
              <input
                class="sp-checkbox"
                type="checkbox"
                :checked="!!optInSender"
                :disabled="busy"
                @change="toggleOptIn(($event.target as HTMLInputElement).checked)"
              />
              <span>
                {{ t('doubleOptIn') }}
                <span class="sp-muted sp-block">{{ t('doubleOptInHint') }}</span>
              </span>
            </label>
            <SpSelect
              v-if="optInSender && senders?.length"
              :model-value="optInSender"
              :label="t('sender')"
              :options="senderOptions"
              :disabled="busy"
              @update:model-value="onSenderChange"
            />
            <p v-if="senders && !senders.length" class="sp-muted">{{ t('noSenders') }}</p>
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
                {{ actionLabel('deal', t('createDeal')) }}
              </button>
            </template>
          </template>
        </div>
      </template>

      <p v-if="notice" class="sp-ok sp-notice" role="status">
        <span>{{ notice }}</span>
        <button
          v-if="undo"
          type="button"
          class="sp-btn sp-btn--text sp-btn--small"
          :disabled="busy"
          @click="undoAdd"
        >
          {{ t('undo') }}
        </button>
      </p>
      <p v-if="error" class="sp-error" role="alert">{{ error }}</p>
      <div class="sp-footer">
        <button type="button" class="sp-btn sp-btn--text sp-btn--small" @click="settingsOpen = true">
          {{ t('settingsTitle') }}
        </button>
        <button
          v-if="rows.length"
          type="button"
          class="sp-btn sp-btn--text sp-btn--small"
          :title="t('exportCsvTitle')"
          @click="exportCsv"
        >
          {{ t('exportCsv') }}
        </button>
      </div>
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
.sp-back {
  margin: 12px 0 0 -12px;
}
.sp-footer {
  display: flex;
  justify-content: space-between;
  margin: 12px -12px 0;
}
.sp-optin {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  cursor: pointer;
}
.sp-optin .sp-checkbox {
  margin-top: 2px;
}
.sp-block {
  display: block;
}
.sp-bulkbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e0e0e0;
}
.sp-bulkbar > .sp-muted {
  flex: 1;
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
.sp-account {
  margin: 4px 0 12px;
}
.sp-hint {
  margin: -6px 12px 0;
}
.sp-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sp-changes {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f1f4f9;
  font-size: 12px;
}
.sp-changes ul {
  margin: 4px 0 8px;
  padding: 0;
  list-style: none;
  word-break: break-word;
}
.sp-changes s {
  color: #5f6368;
}
.sp-bots {
  width: 100%;
  font-size: 12px;
}
.sp-feedback {
  margin: 8px 0 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: #e6f4ea;
  font-size: 12px;
}
.sp-feedback.sp-error {
  background: #fce8e6;
}
.sp-enrich {
  align-self: flex-start;
}
.sp-reminder {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  margin-top: 6px;
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
