<template>
  <p class="sp-error" v-show="content"> {{ content }} </p>
</template>

<script lang="ts">
  export default {
    name: 'error',
    props: ['content']
  };
</script>
