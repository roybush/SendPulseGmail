<script setup lang="ts">
import { computed } from 'vue';
import { PHONE_VARIABLE, type FieldMapping } from '../shared/fields';
import type { BookVariable } from '../shared/types';

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
    { value: NOT_SAVED, label: '— not saved —' },
    ...names.value.map((n) => ({ value: n, label: n })),
  ];
  const current = mapping.value[row.key];
  if (row.key === 'phone' && !names.value.includes(PHONE_VARIABLE)) {
    list.push({ value: PHONE_VARIABLE, label: `${PHONE_VARIABLE} (built-in)` });
  }
  if (current && !list.some((o) => o.value === current))
    list.push({ value: current, label: `${current} (new)` });
  if (row.newName && !names.value.includes(row.newName) && current !== row.newName) {
    list.push({ value: row.newName, label: `+ new variable “${row.newName}”` });
  }
  return list;
}

function set(key: Key, value: string) {
  const next = { ...mapping.value };
  if (value === NOT_SAVED) delete next[key];
  else next[key] = value;
  mapping.value = next;
}
</script>

<template>
  <table class="sp-mapping">
    <tr v-for="row in ROWS" :key="row.key">
      <th scope="row">{{ row.label }}</th>
      <td>
        <select
          :value="mapping[row.key] ?? ''"
          :disabled="disabled"
          :aria-label="`${row.label} goes to`"
          @change="set(row.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in options(row)" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </td>
    </tr>
  </table>
</template>

<style scoped>
.sp-mapping {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th {
  padding: 3px 8px 3px 0;
  color: #5f6368;
  font-weight: normal;
  text-align: left;
  white-space: nowrap;
}
td {
  width: 100%;
  padding: 3px 0;
}
select {
  width: 100%;
  padding: 3px 4px;
  border: 1px solid #c4c7c5;
  border-radius: 4px;
  font: inherit;
}
</style>
