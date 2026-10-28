<script setup lang="ts">
import { computed } from 'vue';
import { PHONE_VARIABLE, type FieldMapping } from '../shared/fields';
import { t, type MessageKey } from '../shared/i18n';
import type { BookVariable } from '../shared/types';
import SpSelect from '../shared/ui/SpSelect.vue';

const props = defineProps<{ variables: BookVariable[]; disabled?: boolean }>();
const mapping = defineModel<FieldMapping>({ required: true });

type Key = keyof FieldMapping;

const ROWS: { key: Key; label: MessageKey; newName?: string }[] = [
  { key: 'first', label: 'firstName' },
  { key: 'last', label: 'lastName' },
  { key: 'full', label: 'fullName' },
  { key: 'phone', label: 'phone' },
  { key: 'company', label: 'company', newName: 'company' },
  { key: 'title', label: 'jobTitle', newName: 'title' },
  { key: 'website', label: 'website', newName: 'website' },
  { key: 'linkedin', label: 'linkedin', newName: 'linkedin' },
];

const NOT_SAVED = '';
const names = computed(() => props.variables.map((v) => v.name));

/** Existing variables, plus a "new variable" choice when the book has nothing that fits. */
function options(row: (typeof ROWS)[number]): { value: string; label: string }[] {
  const list = [
    { value: NOT_SAVED, label: t('notSaved') },
    ...names.value.map((n) => ({ value: n, label: n })),
  ];
  if (row.key === 'phone' && !names.value.includes(PHONE_VARIABLE)) {
    list.push({ value: PHONE_VARIABLE, label: t('builtInVariable', PHONE_VARIABLE) });
  }
  if (row.newName && !names.value.includes(row.newName)) {
    list.push({ value: row.newName, label: t('newVariable', row.newName) });
  }
  const current = mapping.value[row.key];
  if (current && !list.some((o) => o.value === current))
    list.push({ value: current, label: t('newVariableSuffix', current) });
  return list;
}

function set(key: Key, value: string | null) {
  const next = { ...mapping.value };
  if (!value) delete next[key];
  else next[key] = value;
  mapping.value = next;
}
</script>

<template>
  <div class="sp-mapping">
    <SpSelect
      v-for="row in ROWS"
      :key="row.key"
      :label="t(row.label)"
      :options="options(row)"
      :disabled="disabled"
      :model-value="mapping[row.key] ?? NOT_SAVED"
      @update:model-value="set(row.key, $event)"
    />
  </div>
</template>

<style scoped>
.sp-mapping {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 8px;
}
</style>
