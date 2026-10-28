<script setup lang="ts">
import { computed } from 'vue';
import { PHONE_VARIABLE, type FieldMapping } from '../shared/fields';
import type { BookVariable } from '../shared/types';
import SpSelect from '../shared/ui/SpSelect.vue';

const props = defineProps<{ variables: BookVariable[]; disabled?: boolean }>();
const mapping = defineModel<FieldMapping>({ required: true });

type Key = keyof FieldMapping;

const ROWS: { key: Key; label: string; newName?: string }[] = [
  { key: 'first', label: 'First name' },
  { key: 'last', label: 'Last name' },
  { key: 'full', label: 'Full name' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company', newName: 'company' },
  { key: 'title', label: 'Job title', newName: 'title' },
  { key: 'website', label: 'Website', newName: 'website' },
  { key: 'linkedin', label: 'LinkedIn', newName: 'linkedin' },
];

const NOT_SAVED = '';
const names = computed(() => props.variables.map((v) => v.name));

/** Existing variables, plus a "new variable" choice when the book has nothing that fits. */
function options(row: (typeof ROWS)[number]): { value: string; label: string }[] {
  const list = [
    { value: NOT_SAVED, label: 'Not saved' },
    ...names.value.map((n) => ({ value: n, label: n })),
  ];
  if (row.key === 'phone' && !names.value.includes(PHONE_VARIABLE)) {
    list.push({ value: PHONE_VARIABLE, label: `${PHONE_VARIABLE} (built-in)` });
  }
  if (row.newName && !names.value.includes(row.newName)) {
    list.push({ value: row.newName, label: `+ New variable “${row.newName}”` });
  }
  const current = mapping.value[row.key];
  if (current && !list.some((o) => o.value === current))
    list.push({ value: current, label: `${current} (new)` });
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
      :label="row.label"
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
