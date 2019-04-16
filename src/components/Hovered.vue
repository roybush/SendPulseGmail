<template>
  <div @mouseover="mouseover" @mouseout="mouseout" @click="click" :class="classValue" >
    <slot/>
  </div>
</template>
<script lang="ts">

  export default {
    name: 'hovered',
    data() {
      return {
        isHovered: false
      };
    },
    props: {
      triggeredName: {
        type: String,
        default: 'J-JK-JT'
      }
    },
    computed: {
      classValue: function() {
        let value = {};
        value[this.triggeredName] = this.isHovered;
        return value;
      }
    },
    methods: {
      mouseout: function() {
        this.isHovered = false;
      },
      mouseover: function() {
        this.isHovered = true;
      },
      click: function() {
        this.$emit('click');
      }
    }
  };
</script>
