<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { send } from '../shared/messages';

const version = ref('');

onMounted(async () => {
  version.value = (await send({ type: 'ping' })).version;
});
</script>

<template>
  <main>
    <h1>SendPulse for Gmail</h1>
    <p v-if="version">Extension v{{ version }} is running.</p>
    <!-- SendPulse login form lands in stage 4 -->
  </main>
</template>

<style scoped>
main {
  max-width: 480px;
  margin: 32px auto;
  font-family: system-ui, sans-serif;
}
</style>
