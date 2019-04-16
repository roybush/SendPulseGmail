<template>
  <hovered class="T-I J-J5-Ji ar7 nf T-I-ax7 L3 imgHoldr" role="button" @click="click" triggeredName="T-I-JW">
    <img src="../assets/images/sp.png"/>
    <span class="bjy">Send Pulse</span>
    <div class="G-asx T-I-J3 J-J5-Ji">&nbsp;</div>
  </hovered>
</template>
<style scoped lang="sass">
  .imgHoldr
    position: relative
    padding-left: 30px
    img
      width: 20px
      position: absolute
      left: 5px
      top: 4px
</style>
<script lang="ts">

  import Hovered from './Hovered';

  export default {
    name: 'sp-btn',
    components: {
      Hovered,
    },
    methods: {
      click: function() {
        this.$emit('click');
      }
    }
  };
</script>
