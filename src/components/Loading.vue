<template>
  <div class="sp-loading">
    <div class="sp-spinner"></div>
    <span class="sp-loading-text">...Loading {{ what }}</span>
  </div>
</template>
<script lang="ts">
  export default {
    name: 'loading',
    props: {
      what: {
        type: String,
        required: true
      }
    }
  };
</script>
