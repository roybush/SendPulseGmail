<script setup lang="ts">
/** Material 3 outlined text field with a floating label. */
import { useId } from 'vue';

defineProps<{
  label: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  autocomplete?: string;
  hint?: string;
  warning?: string;
}>();
const model = defineModel<string>({ required: true });
const id = useId();
</script>

<template>
  <div class="sp-field" :class="{ 'sp-field--warn': warning }">
    <div class="sp-field__box">
      <input
        :id="id"
        v-model="model"
        class="sp-field__control"
        :type="type ?? 'text'"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete ?? 'off'"
        placeholder=" "
        :aria-describedby="warning || hint ? `${id}-hint` : undefined"
      />
      <label :for="id" class="sp-field__label">{{ label }}</label>
      <span v-if="$slots.trailing" class="sp-field__trailing"><slot name="trailing" /></span>
    </div>
    <div v-if="warning || hint" :id="`${id}-hint`" class="sp-field__hint">{{ warning || hint }}</div>
  </div>
</template>

<style scoped src="./field.css"></style>
