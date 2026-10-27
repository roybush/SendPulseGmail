<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { call } from '../shared/messages';
import type { Membership } from '../shared/types';
import type { Participant } from './participants';

const props = defineProps<{ participants: Participant[] }>();

type Lookup =
  { state: 'loading' } | { state: 'done'; memberships: Membership[] } | { state: 'error'; error: string };

const loggedIn = ref<boolean | null>(null);
const error = ref('');
const lookups = reactive<Record<string, Lookup>>({});

onMounted(async () => {
  try {
    loggedIn.value = (await call('auth.status')).loggedIn;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    return;
  }
  if (!loggedIn.value) return;

  await Promise.all(
    props.participants.map(async (p) => {
      lookups[p.email] = { state: 'loading' };
      try {
        lookups[p.email] = { state: 'done', memberships: await call('contact.find', { email: p.email }) };
      } catch (e) {
        lookups[p.email] = { state: 'error', error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
});

function openSettings() {
  call('app.openOptions').catch(() => {});
}

function statusText(email: string): string {
  const lookup = lookups[email];
  if (!lookup || lookup.state === 'loading') return 'Checking…';
  if (lookup.state === 'error') return lookup.error;
  const n = lookup.memberships.length;
  if (n === 0) return 'Not in SendPulse yet';
  return n === 1 ? 'In 1 address book' : `In ${n} address books`;
}
</script>

<template>
  <div class="sp-panel">
    <p v-if="error" class="sp-error">{{ error }}</p>

    <p v-else-if="loggedIn === false">
      Connect your SendPulse account to see and add contacts.
      <button type="button" class="sp-link" @click="openSettings">Open settings</button>
    </p>

    <template v-else-if="loggedIn">
      <p v-if="!participants.length" class="sp-muted">No other people in this conversation.</p>
      <ul class="sp-people">
        <li v-for="p in participants" :key="p.email">
          <div class="sp-name">{{ p.name || p.email }}</div>
          <div v-if="p.name" class="sp-muted">{{ p.email }}</div>
          <div class="sp-status" :class="{ 'sp-error': lookups[p.email]?.state === 'error' }">
            {{ statusText(p.email) }}
          </div>
        </li>
      </ul>
    </template>
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
.sp-name {
  font-weight: 500;
}
.sp-muted {
  color: #5f6368;
  font-size: 12px;
}
.sp-status {
  margin-top: 4px;
  font-size: 12px;
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
