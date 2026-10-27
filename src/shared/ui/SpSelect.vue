<script setup lang="ts" generic="T extends string | number">
/** Material 3 outlined select; the label always sits on the outline. */
import { useId } from 'vue';

defineProps<{
  label: string;
  options: { value: T; label: string }[];
  disabled?: boolean;
}>();
const model = defineModel<T | null>({ required: true });
const id = useId();
</script>

<template>
  <div class="sp-field">
    <div class="sp-field__box">
      <select
        :id="id"
        v-model="model"
        class="sp-field__control sp-field__control--select"
        :disabled="disabled"
      >
        <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
      </select>
      <label :for="id" class="sp-field__label sp-field__label--float">{{ label }}</label>
      <svg class="sp-field__chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M7 10l5 5 5-5z" fill="currentColor" />
      </svg>
    </div>
  </div>
</template>

<style scoped src="./field.css"></style>
